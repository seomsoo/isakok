import { format } from 'date-fns'
import { rescheduleOverdueItems, type GuideType } from '@moving/shared'

/** 재배치 계산에 필요한 최소 구조 — 서비스 행 타입(ChecklistItemWithMaster)이 이를 만족한다 */
interface ReschedulableChecklistItem {
  id: string
  assigned_date: string
  is_completed: boolean
  master_checklist_items: { guide_type: GuideType } | null
}

/**
 * 빠듯 모드: 과거 미완료 항목의 재배치 결과 맵 (id → display_date)
 * 호출부가 넘긴 목록 기준으로 계산하며, 재배치 대상이 아닌 항목은 맵에 없음
 */
export function computeOverdueDisplayDates(
  items: ReschedulableChecklistItem[],
  movingDate: string,
): Map<string, string> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const mapped = rescheduleOverdueItems(
    items.map((item) => ({
      id: item.id,
      assigned_date: item.assigned_date,
      is_completed: item.is_completed,
      guide_type: item.master_checklist_items?.guide_type ?? 'tip',
    })),
    today,
    movingDate,
  )
  return new Map(mapped.map((r) => [r.id, r.display_date]))
}
