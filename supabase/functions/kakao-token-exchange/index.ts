import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { resolveCorsOrigin, makeCorsHeaders } from '../_shared/cors.ts'

const KAKAO_USER_API = 'https://kapi.kakao.com/v2/user/me'

interface RequestBody {
  kakaoAccessToken: string
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
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

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
    const realEmail = kakaoUser.kakao_account?.email as string | undefined

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
      const email = realEmail ?? `kakao_${kakaoId}@isakok.invalid`
      const { error: updErr } = await admin.auth.admin.updateUserById(currentAnonymousUserId, {
        email,
        email_confirm: true,
        user_metadata: { kakao_id: kakaoId, provider: 'kakao' },
        app_metadata: { provider: 'kakao' },
      })
      if (updErr) {
        const msg = updErr.message?.toLowerCase() ?? ''
        if (msg.includes('already') || msg.includes('duplicate')) {
          return errorResponse(409, 'KAKAO_EMAIL_CONFLICT', cors)
        }
        return errorResponse(500, `updateUser failed: ${updErr.message}`, cors)
      }

      const { error: linkErr } = await admin.from('auth_provider_links').insert({
        provider: 'kakao',
        provider_user_id: kakaoId,
        user_id: currentAnonymousUserId,
      })
      if (linkErr) return errorResponse(500, `link failed: ${linkErr.message}`, cors)

      userId = currentAnonymousUserId
      loginEmail = email
      linked = true
    } else {
      const email = realEmail ?? `kakao_${kakaoId}@isakok.invalid`
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { kakao_id: kakaoId, provider: 'kakao' },
        app_metadata: { provider: 'kakao' },
      })
      if (createErr) {
        const msg = createErr.message?.toLowerCase() ?? ''
        if (msg.includes('already') || msg.includes('duplicate')) {
          return errorResponse(409, 'KAKAO_EMAIL_CONFLICT', cors)
        }
        return errorResponse(500, createErr.message, cors)
      }
      userId = created.user.id

      const { error: newLinkErr } = await admin.from('auth_provider_links').insert({
        provider: 'kakao',
        provider_user_id: kakaoId,
        user_id: userId,
      })
      if (newLinkErr) {
        await admin.auth.admin.deleteUser(userId).catch(() => {})
        return errorResponse(500, `link failed: ${newLinkErr.message}`, cors)
      }
      loginEmail = email
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
    })
    if (linkErr) return errorResponse(500, linkErr.message, cors)
    const tokenHash = link.properties.hashed_token

    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash,
    })
    if (verifyErr) return errorResponse(500, verifyErr.message, cors)
    if (!verified.session) return errorResponse(500, 'session creation failed', cors)

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
    return errorResponse(500, err instanceof Error ? err.message : 'unknown', cors)
  }
})

function errorResponse(status: number, message: string, headers: Record<string, string>) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
