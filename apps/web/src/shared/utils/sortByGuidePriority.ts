import type { GuideType } from '@moving/shared'

const GUIDE_PRIORITY: Record<GuideType, number> = {
  critical: 0,
  warning: 1,
  tip: 2,
}

/** 정렬에 필요한 최소 구조 — 서비스 행 타입(ChecklistItemWithMaster)이 이를 만족한다 */
interface SortableChecklistItem {
  assigned_date: string
  master_checklist_items: { guide_type: GuideType } | null
}

/**
 * guide_type 우선순위 정렬 (critical > warning > tip), 동순위는 assigned_date 오름차순
 */
export function sortByGuidePriority<T extends SortableChecklistItem>(items: T[]): T[] {
  const priorityOf = (item: T) => {
    const guideType = item.master_checklist_items?.guide_type
    return guideType ? GUIDE_PRIORITY[guideType] : 3
  }
  return [...items].sort((a, b) => {
    const pDiff = priorityOf(a) - priorityOf(b)
    if (pDiff !== 0) return pDiff
    return a.assigned_date.localeCompare(b.assigned_date)
  })
}
