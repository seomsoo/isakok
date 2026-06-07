// register-push-token (12단계 §7-1, ADR-093)
// 네이티브가 발급한 ExpoPushToken을 user에 매핑. push_tokens는 service_role only(RLS 정책 없음)라
// 클라이언트 직접 upsert 불가 — 이 함수가 JWT로 현재 user를 확인한 뒤 service_role로 onConflict:token
// upsert 한다. 같은 토큰이 다른 user에 붙어 있어도(기기 양도·재설치·계정삭제 후 새 익명) 안전하게 재할당.
// verify_jwt는 기본값(true) 유지 — 익명 JWT도 플랫폼 검증을 통과하므로 config.toml에 블록 추가하지 않음.
// generate-ai-guide의 "anon getUser + service_role 쓰기" 패턴과 동일.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveCorsOrigin, makeCorsHeaders } from '../_shared/cors.ts'
import type { CorsResolved } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { log } from '../_shared/logger.ts'

function json(body: Record<string, unknown>, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

/** ExpoPushToken 형식만 허용: ExponentPushToken[...] 또는 ExpoPushToken[...] */
function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(value)
}

/** 유저 JWT를 anon client + getUser()로 검증 (직접 decode 금지). 익명 JWT도 통과. */
async function extractUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

serve(async (req) => {
  const resolved: CorsResolved = resolveCorsOrigin(req)
  const cors = makeCorsHeaders(resolved)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: resolved === 'DENY' ? 403 : 204, headers: cors })
  }
  if (resolved === 'DENY') return json({ error: 'CORS_DENIED' }, 403, cors)
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors)

  const userId = await extractUserId(req)
  if (!userId) return json({ error: 'unauthorized' }, 401, cors)

  let body: { token?: unknown; platform?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid body' }, 400, cors)
  }
  const { token, platform } = body
  if (!isExpoPushToken(token)) return json({ error: 'invalid token' }, 400, cors)
  if (platform !== 'ios' && platform !== 'android') {
    return json({ error: 'invalid platform' }, 400, cors)
  }

  // service_role upsert (onConflict:token) — 다른 user에 붙은 토큰도 user_id 최신화.
  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform, last_seen_at: now, updated_at: now },
      { onConflict: 'token' },
    )
  if (error) {
    // 서버 detail은 로그에만, 클라이언트엔 일반 코드 (prod 누수 방지).
    log({ event: 'register_push_token.error', userId, message: error.message })
    return json({ error: 'REGISTER_FAILED' }, 500, cors)
  }

  log({ event: 'register_push_token.ok', userId, platform })
  return json({ ok: true }, 200, cors)
})
