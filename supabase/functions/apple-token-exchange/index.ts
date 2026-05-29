import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveCorsOrigin, makeCorsHeaders } from '../_shared/cors.ts'
import { exchangeAppleAuthCode } from '../_shared/apple.ts'

// Apple authorization code → refresh_token 교환 후 auth_provider_links에 service_role only 저장 (ADR-077).
// 로그인(signInWithIdToken/linkIdentity)으로 세션이 생긴 직후 호출됨 — JWT로 userId 확인.

function errorResponse(status: number, message: string, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  const resolved = resolveCorsOrigin(req)
  const cors = makeCorsHeaders(resolved)

  if (resolved === 'DENY') return errorResponse(403, 'origin not allowed', cors)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return errorResponse(405, 'Method Not Allowed', cors)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'Authorization header missing', cors)
    }

    const body = (await req.json().catch(() => ({}))) as { code?: string }
    if (!body.code) return errorResponse(400, 'code missing', cors)

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
    const userId = userData.user.id

    const { refreshToken, sub, error } = await exchangeAppleAuthCode(body.code)
    if (error || !refreshToken) {
      // 교환 실패: 로그인 자체는 이미 성공한 상태. client는 best-effort라 다음 로그인에서 재확보.
      console.warn('[apple-token-exchange] exchange failed:', error ?? 'no_refresh_token')
      return errorResponse(502, 'APPLE_EXCHANGE_FAILED', cors)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    // sub(Apple 식별자)를 provider_user_id로. 결손 시 userId로 고유성 보장.
    const providerUserId = sub ?? userId
    const { error: upErr } = await admin.from('auth_provider_links').upsert(
      {
        provider: 'apple',
        provider_user_id: providerUserId,
        user_id: userId,
        apple_refresh_token: refreshToken,
      },
      { onConflict: 'provider,provider_user_id' },
    )
    if (upErr) {
      console.error('[apple-token-exchange] link upsert failed:', upErr.message)
      return errorResponse(500, 'APPLE_LINK_FAILED', cors)
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[apple-token-exchange:unhandled]', err instanceof Error ? err.message : err)
    return errorResponse(500, 'APPLE_EXCHANGE_FAILED', cors)
  }
})
