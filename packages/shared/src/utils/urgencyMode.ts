import { parseLocalDate } from './dateLabel'

/**
 * 이사일까지 남은 일수에 따라 긴급도 모드를 반환
 * - relaxed (D-30+): 기존 UX
 * - tight (D-14~29): 과거 미완료를 표시용 날짜로 재분배
 * - urgent (D-7~13): 날짜 그룹 → 긴급도 그룹으로 전환
 * - critical (D-1~6, D-Day, D+): 필수만 강조
 */
export type UrgencyMode = 'relaxed' | 'tight' | 'urgent' | 'critical'

export function getUrgencyMode(daysUntilMove: number): UrgencyMode {
  if (daysUntilMove >= 30) return 'relaxed'
  if (daysUntilMove >= 14) return 'tight'
  if (daysUntilMove >= 7) return 'urgent'
  return 'critical'
}

interface ChecklistItemForReschedule {
  id: string
  assigned_date: string
  is_completed: boolean
  guide_type: 'critical' | 'warning' | 'tip'
}

export interface RescheduledItem {
  id: string
  display_date: string
}

const PRIORITY_ORDER: Record<'critical' | 'warning' | 'tip', number> = {
  critical: 0,
  warning: 1,
  tip: 2,
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function diffDays(from: Date, to: Date): number {
  const MS = 24 * 60 * 60 * 1000
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const t = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.round((t - f) / MS)
}

/**
 * 빠듯 모드 전용: 과거 미완료 항목의 표시용 날짜를 오늘~7일 범위에 균등 분배
 * - 중요도순 정렬 (critical → warning → tip, 같은 중요도 내 assigned_date 오름차순)
 * - 7일(이사일이 더 짧으면 남은 날)에 인덱스 % spreadDays 로 순환 배치
 */
export function rescheduleOverdueItems(
  items: ChecklistItemForReschedule[],
  today: string,
  movingDate: string,
): RescheduledItem[] {
  const overdueItems = items.filter(
    (item) => !item.is_completed && item.assigned_date < today,
  )
  if (overdueItems.length === 0) return []

  const sorted = [...overdueItems].sort((a, b) => {
    const p = PRIORITY_ORDER[a.guide_type] - PRIORITY_ORDER[b.guide_type]
    if (p !== 0) return p
    return a.assigned_date.localeCompare(b.assigned_date)
  })

  const todayDate = parseLocalDate(today)
  const movingDay = parseLocalDate(movingDate)
  const maxSpreadDays = Math.min(diffDays(todayDate, movingDay), 7)
  const spreadDays = Math.max(maxSpreadDays, 1)

  return sorted.map((item, index) => {
    const target = new Date(todayDate)
    target.setDate(target.getDate() + (index % spreadDays))
    return { id: item.id, display_date: formatDateLocal(target) }
  })
}
