import { format } from 'date-fns'
import { rescheduleOverdueItems } from '@moving/shared'

/**
 * 빠듯 모드: 과거 미완료 항목의 재배치 결과 맵 (id → display_date)
 * 호출부가 넘긴 목록 기준으로 계산하며, 재배치 대상이 아닌 항목은 맵에 없음
 */
export function computeOverdueDisplayDates(
  items: Record<string, unknown>[],
  movingDate: string,
): Map<string, string> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const mapped = rescheduleOverdueItems(
    items.map((item) => ({
      id: item.id as string,
      assigned_date: item.assigned_date as string,
      is_completed: item.is_completed as boolean,
      guide_type:
        (item.master_checklist_items as { guide_type?: 'critical' | 'warning' | 'tip' } | null)
          ?.guide_type ?? 'tip',
    })),
    today,
    movingDate,
  )
  return new Map(mapped.map((r) => [r.id, r.display_date]))
}
