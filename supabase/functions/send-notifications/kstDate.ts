import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

/**
 * KST 오늘 (YYYY-MM-DD). DB 기준 (now() AT TIME ZONE 'Asia/Seoul')::date — Deno 런타임은 UTC라
 * new Date()의 날짜 계산을 쓰지 않는다(ADR-094). kst_today() RPC로 단일 진실을 고정한다.
 */
export async function getKstToday(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.rpc('kst_today')
  if (error || !data) throw new Error(`kst_today failed: ${error?.message ?? 'no data'}`)
  return data as string
}

/**
 * 두 YYYY-MM-DD 날짜의 일수 차 (to - from). 양쪽을 UTC 자정으로 파싱해 TZ 영향 0.
 * dDay = diffCalendarDays(kstToday, movingDate).
 */
export function diffCalendarDays(fromYmd: string, toYmd: string): number {
  const from = Date.parse(`${fromYmd}T00:00:00Z`)
  const to = Date.parse(`${toYmd}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}
