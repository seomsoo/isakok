import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { resolveCorsOrigin, makeCorsHeaders } from '../_shared/cors.ts'

const BUCKET = 'property-photos'
const LIST_PAGE_SIZE = 1000
const REMOVE_CHUNK_SIZE = 100
const REMOVE_MAX_RETRIES = 3
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * 재귀적으로 `{userId}/{moveId}/...` 중첩 파일까지 수집.
 * storage.objects 직접 조회 대신 public Storage API(`list()`)만 사용.
 * 폴더당 1000개 초과 시 offset pagination이 필요할 수 있으나 일반 사용자 규모에서는 발생 가능성 낮음.
 */
async function listStoragePathsByPrefix(admin: SupabaseClient, userId: string): Promise<string[]> {
  const bucket = admin.storage.from(BUCKET)
  const out: string[] = []
  const { data: lvl1, error: lvl1Err } = await bucket.list(userId, { limit: LIST_PAGE_SIZE })
  if (lvl1Err) throw new Error(`list lvl1 failed: ${lvl1Err.message}`)
  for (const entry of lvl1 ?? []) {
    if (entry.id === null) {
      const { data: lvl2, error: lvl2Err } = await bucket.list(`${userId}/${entry.name}`, {
        limit: LIST_PAGE_SIZE,
      })
      if (lvl2Err) throw new Error(`list lvl2 failed: ${lvl2Err.message}`)
      for (const f of lvl2 ?? []) out.push(`${userId}/${entry.name}/${f.name}`)
    } else {
      out.push(`${userId}/${entry.name}`)
    }
  }
  return out
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

    const paths = await listStoragePathsByPrefix(admin, userId)
    console.log(`[delete-account] userId=${userId} initial_paths=${paths.length}`)

    for (const chunk of chunkArray(paths, REMOVE_CHUNK_SIZE)) {
      let ok = false
      for (let attempt = 1; attempt <= REMOVE_MAX_RETRIES; attempt++) {
        const { error } = await admin.storage.from(BUCKET).remove(chunk)
        if (!error) {
          ok = true
          break
        }
        console.warn(
          `[delete-account:storage-remove] attempt=${attempt} chunk_size=${chunk.length} error=${error.message}`,
        )
        if (attempt < REMOVE_MAX_RETRIES) await sleep(300 * attempt)
      }
      if (!ok) {
        return errorResponse(500, 'storage-remove failed', cors, { stage: 'storage-remove' })
      }
    }

    // 삭제 후 prefix 재조회 → 잔여 0건 확인 (트리거 우회·부분 실패 방어)
    const remaining = await listStoragePathsByPrefix(admin, userId)
    if (remaining.length > 0) {
      console.error(
        `[delete-account:storage-verify] userId=${userId} remaining=${remaining.length}`,
      )
      return errorResponse(500, 'storage residue', cors, {
        stage: 'storage-verify',
        remaining: remaining.length,
      })
    }

    // auth_provider_links 명시 삭제 (deleteUser 전; partial cleanup 시 로그 유지)
    const { error: linkErr } = await admin
      .from('auth_provider_links')
      .delete()
      .eq('user_id', userId)
    if (linkErr) {
      console.error('[delete-account:auth-provider-links]', linkErr.message)
      return errorResponse(500, 'links cleanup failed', cors, { stage: 'auth-provider-links' })
    }

    // CASCADE: auth.users 삭제 시 public.users → moves/user_checklist_items/property_photos 자동
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) {
      console.error(`[delete-account:delete-user] userId=${userId} error=${delErr.message}`)
      return errorResponse(500, 'delete-user failed', cors, { stage: 'delete-user' })
    }

    console.log(`[delete-account] OK userId=${userId} removed_paths=${paths.length}`)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[delete-account:unhandled]', err instanceof Error ? err.message : err)
    return errorResponse(500, 'DELETE_ACCOUNT_FAILED', cors)
  }
})
