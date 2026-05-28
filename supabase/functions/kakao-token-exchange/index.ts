import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveCorsOrigin, makeCorsHeaders } from '../_shared/cors.ts'

const KAKAO_USER_API = 'https://kapi.kakao.com/v2/user/me'

interface RequestBody {
  kakaoAccessToken: string
}

interface AuthAdminUpdateError extends Error {
  code?: string
  status?: number
  body?: string
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function truncateToMinute(d: Date): string {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ).toISOString()
}

function truncateToHour(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).toISOString()
}

function extractClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? null
}

function resolveKakaoEmail(
  kakaoId: string,
  rawEmail: unknown,
  stableSuffix: string,
): {
  email: string
  hasRealEmail: boolean
} {
  const hasRealEmail =
    typeof rawEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail.trim())
  const safeKakaoId = kakaoId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
  const safeSuffix = stableSuffix.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)
  return { email: `kakao_${safeKakaoId}_${safeSuffix}@isakok.invalid`, hasRealEmail }
}

async function updateAuthUserById(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  attributes: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(attributes),
  })

  if (res.ok) return

  const body = await res.text().catch(() => '')
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(body) as Record<string, unknown>
  } catch {
    parsed = {}
  }

  const message =
    typeof parsed.message === 'string'
      ? parsed.message
      : typeof parsed.error_description === 'string'
        ? parsed.error_description
        : typeof parsed.error === 'string'
          ? parsed.error
          : body || res.statusText
  const err = new Error(message) as AuthAdminUpdateError
  err.name = 'AuthAdminUpdateError'
  err.status = res.status
  if (typeof parsed.code === 'string') err.code = parsed.code
  if (!err.code && typeof parsed.error_code === 'string') err.code = parsed.error_code
  if (!err.code && typeof parsed.error === 'string') err.code = parsed.error
  err.body = body.slice(0, 500)
  throw err
}

serve(async (req) => {
  const resolved = resolveCorsOrigin(req)
  const cors = makeCorsHeaders(resolved)

  if (resolved === 'DENY') {
    return new Response(JSON.stringify({ error: 'origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (req.method !== 'POST') {
    return errorResponse(405, 'Method Not Allowed', cors)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'Authorization header missing', cors)
    }

    const body = (await req.json()) as RequestBody
    if (!body.kakaoAccessToken) return errorResponse(400, 'kakaoAccessToken missing', cors)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return errorResponse(401, 'JWT verification failed', cors)

    const jwtUserId = userData.user.id

    // --- rate limit ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const now = new Date()
    const userResult = await admin.rpc('increment_rate_limit', {
      p_bucket_key: `kakao:user:${jwtUserId}`,
      p_window_start: truncateToMinute(now),
      p_limit: 5,
    })
    if (userResult.error) {
      console.error('[rate-limit:user]', userResult.error)
      return errorResponse(503, 'rate limit unavailable', cors)
    }
    if (!userResult.data) {
      return errorResponse(429, 'rate limited', cors)
    }

    const clientIp = extractClientIp(req)
    if (clientIp) {
      const salt = Deno.env.get('RATE_LIMIT_SALT') ?? ''
      const ipHash = await sha256(`${clientIp}:${salt}`)
      const ipResult = await admin.rpc('increment_rate_limit', {
        p_bucket_key: `kakao:ip:${ipHash}`,
        p_window_start: truncateToHour(now),
        p_limit: 30,
      })
      if (ipResult.error) {
        console.error('[rate-limit:ip]', ipResult.error)
        return errorResponse(503, 'rate limit unavailable', cors)
      }
      if (!ipResult.data) {
        return errorResponse(429, 'rate limited', cors)
      }
    }

    const currentAnonymousUserId = userData.user.is_anonymous ? userData.user.id : null

    const kakaoRes = await fetch(KAKAO_USER_API, {
      headers: { Authorization: `Bearer ${body.kakaoAccessToken}` },
    })
    if (!kakaoRes.ok) return errorResponse(401, 'Kakao token verification failed', cors)
    const kakaoUser = await kakaoRes.json()
    const kakaoId = String(kakaoUser.id)

    // provider-level rate limit — 익명→실명 직후 user 키 리셋으로 user/IP 둘 다 우회 가능한 케이스
    // 차단. kakaoId 평문은 식별자라 RATE_LIMIT_SALT 와 함께 해시 후 키로 사용.
    const kakaoIdHash = await sha256(`kakao:${kakaoId}:${Deno.env.get('RATE_LIMIT_SALT') ?? ''}`)
    const providerResult = await admin.rpc('increment_rate_limit', {
      p_bucket_key: `kakao:provider:${kakaoIdHash}`,
      p_window_start: truncateToHour(now),
      p_limit: 30,
    })
    if (providerResult.error) {
      console.error('[rate-limit:provider]', providerResult.error)
      return errorResponse(503, 'rate limit unavailable', cors)
    }
    if (!providerResult.data) {
      return errorResponse(429, 'rate limited', cors)
    }

    const { email: kakaoEmail, hasRealEmail } = resolveKakaoEmail(
      kakaoId,
      kakaoUser.kakao_account?.email,
      currentAnonymousUserId ?? crypto.randomUUID(),
    )

    const { data: existingLink } = await admin
      .from('auth_provider_links')
      .select('user_id')
      .eq('provider', 'kakao')
      .eq('provider_user_id', kakaoId)
      .maybeSingle()

    let userId: string
    let linked = false
    let loginEmail: string

    if (existingLink) {
      userId = existingLink.user_id

      if (currentAnonymousUserId && existingLink.user_id === currentAnonymousUserId) {
        linked = true
      } else {
        linked = false
      }

      const { data: existingUser } = await admin.auth.admin.getUserById(userId)
      loginEmail = existingUser.user?.email ?? `kakao_${kakaoId}@isakok.invalid`
    } else if (currentAnonymousUserId) {
      try {
        await updateAuthUserById(supabaseUrl, serviceRoleKey, currentAnonymousUserId, {
          email: kakaoEmail,
          email_confirm: true,
          user_metadata: { kakao_id: kakaoId, provider: 'kakao' },
          app_metadata: { provider: 'kakao', providers: ['kakao'] },
        })
      } catch (updErr) {
        const err = updErr as AuthAdminUpdateError
        // body 에 placeholder 이메일(kakaoId 평문 포함) 이 echo 될 수 있어 length 메타만 기록.
        console.error('[kakao-exchange:updateUserById]', {
          code: err.code,
          status: err.status,
          name: err.name,
          message: err.message,
          bodyLen: err.body?.length ?? 0,
          hasRealEmail,
        })
        const msg = err.message?.toLowerCase() ?? ''
        if (msg.includes('already') || msg.includes('duplicate')) {
          return errorResponse(409, 'KAKAO_EMAIL_CONFLICT', cors)
        }
        return errorResponse(500, 'KAKAO_USER_UPDATE_FAILED', cors)
      }

      const { error: linkErr } = await admin.from('auth_provider_links').insert({
        provider: 'kakao',
        provider_user_id: kakaoId,
        user_id: currentAnonymousUserId,
      })
      if (linkErr) {
        console.error('[kakao-exchange:link-insert-anon]', linkErr.message)
        return errorResponse(500, 'KAKAO_LINK_FAILED', cors)
      }

      userId = currentAnonymousUserId
      loginEmail = kakaoEmail
      linked = true
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: kakaoEmail,
        email_confirm: true,
        user_metadata: { kakao_id: kakaoId, provider: 'kakao' },
        app_metadata: { provider: 'kakao', providers: ['kakao'] },
      })
      if (createErr) {
        const msg = createErr.message?.toLowerCase() ?? ''
        if (msg.includes('already') || msg.includes('duplicate')) {
          return errorResponse(409, 'KAKAO_EMAIL_CONFLICT', cors)
        }
        console.error('[kakao-exchange:createUser]', createErr.message)
        return errorResponse(500, 'KAKAO_USER_CREATE_FAILED', cors)
      }
      userId = created.user.id

      const { error: newLinkErr } = await admin.from('auth_provider_links').insert({
        provider: 'kakao',
        provider_user_id: kakaoId,
        user_id: userId,
      })
      if (newLinkErr) {
        console.error('[kakao-exchange:link-insert-new]', newLinkErr.message)
        // orphan auth.user 가 남으면 같은 kakaoId 재시도 시 placeholder 이메일 409 락아웃 발생.
        // 정리 실패 시 메트릭으로 가시화해 수동 정리 가능하게 한다.
        await admin.auth.admin
          .deleteUser(userId)
          .catch((delErr: { code?: string; message?: string } | null) =>
            console.warn('[kakao-exchange:orphan-cleanup-failed]', {
              userId,
              code: delErr?.code,
              message: delErr?.message?.slice(0, 80),
            }),
          )
        return errorResponse(500, 'KAKAO_LINK_FAILED', cors)
      }
      loginEmail = kakaoEmail
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
    })
    if (linkErr) {
      console.error('[kakao-exchange:generateLink]', linkErr.message)
      return errorResponse(500, 'KAKAO_LOGIN_FAILED', cors)
    }
    const tokenHash = link.properties.hashed_token

    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash,
    })
    if (verifyErr) {
      console.error('[kakao-exchange:verifyOtp]', verifyErr.message)
      return errorResponse(500, 'KAKAO_LOGIN_FAILED', cors)
    }
    if (!verified.session) {
      console.error('[kakao-exchange:verifyOtp] session missing')
      return errorResponse(500, 'KAKAO_LOGIN_FAILED', cors)
    }

    return new Response(
      JSON.stringify({
        access_token: verified.session.access_token,
        refresh_token: verified.session.refresh_token,
        linked,
        user_id: userId,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[kakao-exchange:unhandled]', err instanceof Error ? err.message : err)
    return errorResponse(500, 'KAKAO_LOGIN_FAILED', cors)
  }
})

function errorResponse(status: number, message: string, headers: Record<string, string>) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
