import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveCorsOrigin, makeCorsHeaders } from '../_shared/cors.ts'
import { deleteUserCompletely, DeleteUserError } from '../_shared/deleteUserData.ts'
import { revokeAppleToken } from '../_shared/apple.ts'

const RATE_LIMIT_PER_MINUTE = 3

function truncateToMinute(d: Date): string {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ).toISOString()
}

function errorResponse(
  status: number,
  message: string,
  headers: Record<string, string>,
  extra?: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify({ error: message, ...(extra ?? {}) }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  const resolved = resolveCorsOrigin(req)
  const cors = makeCorsHeaders(resolved)

  if (resolved === 'DENY') {
    return errorResponse(403, 'origin not allowed', cors)
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

    if (userData.user.is_anonymous) {
      return errorResponse(403, 'anonymous user cannot delete account', cors)
    }

    const userId = userData.user.id

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const now = new Date()
    const rateResult = await admin.rpc('increment_rate_limit', {
      p_bucket_key: `delete-account:user:${userId}`,
      p_window_start: truncateToMinute(now),
      p_limit: RATE_LIMIT_PER_MINUTE,
    })
    if (rateResult.error) {
      console.error('[delete-account:rate-limit]', rateResult.error.message)
      return errorResponse(503, 'rate limit unavailable', cors)
    }
    if (!rateResult.data) {
      return errorResponse(429, 'rate limited', cors)
    }

    // Apple revoke (ADR-077, best-effort 5s): refresh_token이 service_role only라 서버에서 호출.
    // deleteUserCompletely가 auth_provider_links를 지우므로 그 전에 조회·revoke. invalid_grant 등 실패는 무시.
    // 전체를 try로 감싸 조회/revoke의 어떤 실패도 계정 삭제를 막지 않게 한다(best-effort 보장).
    try {
      const { data: appleLink } = await admin
        .from('auth_provider_links')
        .select('apple_refresh_token')
        .eq('user_id', userId)
        .eq('provider', 'apple')
        .not('apple_refresh_token', 'is', null)
        .limit(1)
        .maybeSingle()
      if (appleLink?.apple_refresh_token) {
        const revoke = await revokeAppleToken(appleLink.apple_refresh_token, 5000)
        if (!revoke.ok) console.warn('[delete-account:apple-revoke] failed:', revoke.error)
      }
    } catch (e) {
      console.warn('[delete-account:apple-revoke] skipped:', e instanceof Error ? e.message : e)
    }

    // 삭제 코어 (ADR-082): Storage → auth_provider_links → auth.users(public.* CASCADE)
    const { removedPaths } = await deleteUserCompletely(admin, userId)
    console.log(`[delete-account] OK userId=${userId} removed_paths=${removedPaths}`)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (err instanceof DeleteUserError) {
      // 상세(userId·원인)는 deleteUserData 코어가 이미 로깅. client엔 일반 메시지 + stage만.
      console.error(`[delete-account] failed stage=${err.stage}`)
      return errorResponse(500, err.message, cors, { stage: err.stage, ...(err.extra ?? {}) })
    }
    console.error('[delete-account:unhandled]', err instanceof Error ? err.message : err)
    return errorResponse(500, 'DELETE_ACCOUNT_FAILED', cors)
  }
})
