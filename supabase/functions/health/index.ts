import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// 헬스체크 (스펙 11 §3-2, ADR-087 — 스펙 본문 표기 ADR-086): "웹뿐 아니라 DB까지 살아있다"를 증명.
//   - GET/HEAD만 허용 (그 외 405)
//   - 응답은 200 {"status":"ok"} 또는 503 {"status":"error"}만. DB 값·version·config key·row content 미반환.
//   - anon key + 공개 SELECT 정책(master_checklist_items)으로 경량 접촉 — service_role 미사용.
//   - timeout 2s, Cache-Control: no-store, 요청 IP/헤더 원문 미기록.
// UptimeRobot이 인증 없이 5분 간격 호출 → 배포 시 verify_jwt=false (config.toml [functions.health]).

const HEALTH_TIMEOUT_MS = 2000
const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

function jsonResponse(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: COMMON_HEADERS })
}

/**
 * DB 생존 확인 — 공개 SELECT 테이블에 head count(행 본문 없음)로 연결만 확인.
 * 2초 내 응답 없거나 에러면 false.
 */
async function checkDatabase(): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) return false

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('health timeout')), HEALTH_TIMEOUT_MS)
  })
  try {
    const probe = supabase
      .from('master_checklist_items')
      .select('id', { count: 'exact', head: true })
      .then((r) => !r.error)
    return await Promise.race([probe, timeout])
  } catch {
    return false
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return jsonResponse(405, { status: 'error' })
  }

  const ok = await checkDatabase()
  if (!ok) {
    // 요청 IP/헤더는 기록하지 않음 — 상태만
    console.error('[health] db check failed')
    return jsonResponse(503, { status: 'error' })
  }

  if (req.method === 'HEAD') {
    return new Response(null, { status: 200, headers: COMMON_HEADERS })
  }
  return jsonResponse(200, { status: 'ok' })
})
