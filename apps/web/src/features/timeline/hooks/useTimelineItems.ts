import { useQuery } from '@tanstack/react-query'
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  parseISO,
  differenceInCalendarDays,
  isBefore,
  isAfter,
  isWithinInterval,
  format,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  rescheduleOverdueItems,
  URGENCY_GROUP_LABELS,
  type UrgencyMode,
} from '@moving/shared'
import { getTimelineItems } from '@/services/checklist'
import { queryKeys } from '@/features/dashboard/hooks/queryKeys'

export interface PeriodGroup {
  key: string
  label: string
  items: Record<string, unknown>[]
  completedCount: number
  totalCount: number
  isCurrent: boolean
  overdueItems: Record<string, unknown>[]
}

export interface TimelinePeriods {
  periods: PeriodGroup[]
  completedItems: Record<string, unknown>[]
  skippableItems: Record<string, unknown>[]
  currentIndex: number
  progress: { completed: number; total: number; percentage: number }
}

const PERIOD_KEYS = {
  THIS_WEEK: 'THIS_WEEK',
  NEXT_WEEK: 'NEXT_WEEK',
  MOVING_WEEK: 'MOVING_WEEK',
  AFTER_MOVE: 'AFTER_MOVE',
} as const

const GUIDE_PRIORITY: Record<string, number> = {
  critical: 0,
  warning: 1,
  tip: 2,
}

export function useTimelineItems(
  moveId: string,
  movingDate: string,
  mode: UrgencyMode = 'relaxed',
) {
  return useQuery({
    queryKey: [...queryKeys.timelineItems(moveId), mode],
    queryFn: () => getTimelineItems(moveId),
    enabled: !!moveId && !!movingDate,
    select: (data) => {
      if (mode === 'urgent' || mode === 'critical') {
        return groupByUrgency(data, movingDate, mode)
      }
      if (mode === 'tight') {
        return groupByPeriod(applyReschedule(data, movingDate), movingDate)
      }
      return groupByPeriod(data, movingDate)
    },
  })
}

function applyReschedule(items: Record<string, unknown>[], movingDate: string) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const mapped = rescheduleOverdueItems(
    items.map((item) => ({
      id: item.id as string,
      assigned_date: item.assigned_date as string,
      is_completed: item.is_completed as boolean,
      guide_type:
        ((item.master_checklist_items as { guide_type?: 'critical' | 'warning' | 'tip' } | null)
          ?.guide_type as 'critical' | 'warning' | 'tip') ?? 'tip',
    })),
    today,
    movingDate,
  )
  const displayMap = new Map(mapped.map((r) => [r.id, r.display_date]))
  return items.map((item) => {
    const display = displayMap.get(item.id as string)
    if (!display) return item
    return { ...item, assigned_date: display, _original_date: item.assigned_date }
  })
}

/**
 * 날짜 라벨 생성 (스펙 8-2)
 */
export function getDateLabel(assignedDate: string, movingDate: string): string {
  const today = new Date()
  const assigned = parseISO(assignedDate)
  const moving = parseISO(movingDate)
  const daysFromToday = differenceInCalendarDays(assigned, today)
  const daysFromMoving = differenceInCalendarDays(assigned, moving)

  if (daysFromToday <= 0) return '오늘'
  if (daysFromToday === 1) return '내일'
  if (daysFromMoving === -1) return '이사 전날'
  if (daysFromMoving === 0) return '이사 당일'
  if (daysFromMoving > 0) return `이사 후 ${daysFromMoving}일`
  return format(assigned, 'M월 d일 (E)', { locale: ko })
}

function sortByGuide(items: Record<string, unknown>[]) {
  return [...items].sort((a, b) => {
    const masterA = a.master_checklist_items as Record<string, unknown> | null
    const masterB = b.master_checklist_items as Record<string, unknown> | null
    const pDiff =
      (GUIDE_PRIORITY[masterA?.guide_type as string] ?? 3) -
      (GUIDE_PRIORITY[masterB?.guide_type as string] ?? 3)
    if (pDiff !== 0) return pDiff
    return (a.assigned_date as string).localeCompare(b.assigned_date as string)
  })
}

function groupByPeriod(items: Record<string, unknown>[], movingDate: string): TimelinePeriods {
  const today = new Date()
  const movingDay = parseISO(movingDate)
  const weekOpts = { weekStartsOn: 1 as const }

  const thisWeekStart = startOfWeek(today, weekOpts)
  const thisWeekEnd = endOfWeek(today, weekOpts)
  const nextWeekStart = addWeeks(thisWeekStart, 1)
  const nextWeekEnd = addWeeks(thisWeekEnd, 1)
  const movingWeekStart = startOfWeek(movingDay, weekOpts)
  const movingWeekEnd = endOfWeek(movingDay, weekOpts)

  const movingIsThisWeek = isWithinInterval(movingDay, { start: thisWeekStart, end: thisWeekEnd })
  const movingIsNextWeek = isWithinInterval(movingDay, { start: nextWeekStart, end: nextWeekEnd })

  const periods = new Map<
    string,
    {
      label: string
      isCurrent: boolean
      items: Record<string, unknown>[]
      overdueItems: Record<string, unknown>[]
    }
  >()

  const thisWeekLabel = movingIsThisWeek ? '이번 주 (이사 주)' : '이번 주'
  periods.set(PERIOD_KEYS.THIS_WEEK, {
    label: thisWeekLabel,
    isCurrent: true,
    items: [],
    overdueItems: [],
  })

  if (!movingIsThisWeek) {
    const nextWeekLabel = movingIsNextWeek ? '다음 주 (이사 주)' : '다음 주'
    periods.set(PERIOD_KEYS.NEXT_WEEK, {
      label: nextWeekLabel,
      isCurrent: false,
      items: [],
      overdueItems: [],
    })
  }

  if (!movingIsThisWeek && !movingIsNextWeek) {
    periods.set(PERIOD_KEYS.MOVING_WEEK, {
      label: '이사 주',
      isCurrent: false,
      items: [],
      overdueItems: [],
    })
  }

  periods.set(PERIOD_KEYS.AFTER_MOVE, {
    label: '이사 후',
    isCurrent: false,
    items: [],
    overdueItems: [],
  })

  const completedItems: Record<string, unknown>[] = []

  for (const item of items) {
    const assignedDate = parseISO(item.assigned_date as string)
    const isCompleted = item.is_completed as boolean

    if (isCompleted) {
      completedItems.push(item)
      continue
    }

    if (isBefore(assignedDate, thisWeekStart)) {
      periods.get(PERIOD_KEYS.THIS_WEEK)?.overdueItems.push(item)
      continue
    }

    if (isWithinInterval(assignedDate, { start: thisWeekStart, end: thisWeekEnd })) {
      periods.get(PERIOD_KEYS.THIS_WEEK)?.items.push(item)
      continue
    }

    if (isWithinInterval(assignedDate, { start: nextWeekStart, end: nextWeekEnd })) {
      const targetKey = movingIsThisWeek ? PERIOD_KEYS.AFTER_MOVE : PERIOD_KEYS.NEXT_WEEK
      periods.get(targetKey)?.items.push(item)
      continue
    }

    if (isAfter(assignedDate, movingDay)) {
      periods.get(PERIOD_KEYS.AFTER_MOVE)?.items.push(item)
      continue
    }

    if (movingIsThisWeek) {
      periods.get(PERIOD_KEYS.THIS_WEEK)?.items.push(item)
    } else if (movingIsNextWeek) {
      periods.get(PERIOD_KEYS.NEXT_WEEK)?.items.push(item)
    } else if (
      isWithinInterval(assignedDate, { start: movingWeekStart, end: movingWeekEnd }) ||
      (isAfter(assignedDate, nextWeekEnd) && !isAfter(assignedDate, movingDay))
    ) {
      periods.get(PERIOD_KEYS.MOVING_WEEK)?.items.push(item)
    }
  }

  const thisWeekPeriod = periods.get(PERIOD_KEYS.THIS_WEEK)
  if (thisWeekPeriod) {
    thisWeekPeriod.overdueItems.sort((a, b) => {
      const masterA = a.master_checklist_items as Record<string, unknown> | null
      const masterB = b.master_checklist_items as Record<string, unknown> | null
      return (
        (GUIDE_PRIORITY[masterA?.guide_type as string] ?? 3) -
        (GUIDE_PRIORITY[masterB?.guide_type as string] ?? 3)
      )
    })
  }

  const result: PeriodGroup[] = []
  let currentIndex = 0

  for (const [key, period] of periods) {
    const allItems = [...period.overdueItems, ...period.items]
    if (allItems.length === 0) continue

    if (period.isCurrent) currentIndex = result.length

    result.push({
      key,
      label: period.label,
      items: period.items,
      completedCount: 0,
      totalCount: allItems.length,
      isCurrent: period.isCurrent,
      overdueItems: period.overdueItems,
    })
  }

  const totalCompleted = completedItems.length
  const total = items.length

  return {
    periods: result,
    completedItems,
    skippableItems: [],
    currentIndex,
    progress: {
      completed: totalCompleted,
      total,
      percentage: total > 0 ? Math.round((totalCompleted / total) * 100) : 0,
    },
  }
}

/**
 * 급한/초급한 모드 그룹핑
 * - urgent: now / thisWeek / movingDay / afterMove / canSkip
 * - critical: essential / canSkip
 */
function groupByUrgency(
  items: Record<string, unknown>[],
  movingDate: string,
  mode: 'urgent' | 'critical',
): TimelinePeriods {
  const today = format(new Date(), 'yyyy-MM-dd')

  const completedItems: Record<string, unknown>[] = []
  const activeItems: Record<string, unknown>[] = []

  for (const item of items) {
    if (item.is_completed) completedItems.push(item)
    else activeItems.push(item)
  }

  const isSkippable = (item: Record<string, unknown>) =>
    (item.master_checklist_items as { is_skippable?: boolean } | null)?.is_skippable === true
  const guideType = (item: Record<string, unknown>) =>
    (item.master_checklist_items as { guide_type?: string } | null)?.guide_type

  const periods: PeriodGroup[] = []
  const skippableItems: Record<string, unknown>[] = []

  if (mode === 'critical') {
    const essentials: Record<string, unknown>[] = []
    for (const item of activeItems) {
      if (isSkippable(item)) skippableItems.push(item)
      else essentials.push(item)
    }
    periods.push({
      key: 'ESSENTIAL',
      label: URGENCY_GROUP_LABELS.essential,
      items: sortByGuide(essentials),
      completedCount: 0,
      totalCount: essentials.length,
      isCurrent: true,
      overdueItems: [],
    })
  } else {
    // urgent
    const nowItems: Record<string, unknown>[] = []
    const thisWeekItems: Record<string, unknown>[] = []
    const movingDayItems: Record<string, unknown>[] = []
    const afterMoveItems: Record<string, unknown>[] = []

    const movingDay = parseISO(movingDate)

    for (const item of activeItems) {
      if (isSkippable(item) && guideType(item) === 'tip') {
        skippableItems.push(item)
        continue
      }
      const assignedStr = item.assigned_date as string
      const assigned = parseISO(assignedStr)
      const daysToMoving = differenceInCalendarDays(assigned, movingDay)

      if (assignedStr <= today) {
        nowItems.push(item)
      } else if (daysToMoving === -1 || daysToMoving === 0) {
        movingDayItems.push(item)
      } else if (daysToMoving > 0) {
        afterMoveItems.push(item)
      } else {
        thisWeekItems.push(item)
      }
    }

    const addGroup = (key: string, label: string, items: Record<string, unknown>[], isCurrent = false) => {
      if (items.length === 0) return
      periods.push({
        key,
        label,
        items: sortByGuide(items),
        completedCount: 0,
        totalCount: items.length,
        isCurrent,
        overdueItems: [],
      })
    }

    addGroup('NOW', URGENCY_GROUP_LABELS.now, nowItems, true)
    addGroup('THIS_WEEK', URGENCY_GROUP_LABELS.thisWeek, thisWeekItems)
    addGroup('MOVING_DAY', URGENCY_GROUP_LABELS.movingDay, movingDayItems)
    addGroup('AFTER_MOVE', URGENCY_GROUP_LABELS.afterMove, afterMoveItems)
  }

  const total = items.length
  const totalCompleted = completedItems.length

  return {
    periods,
    completedItems,
    skippableItems,
    currentIndex: 0,
    progress: {
      completed: totalCompleted,
      total,
      percentage: total > 0 ? Math.round((totalCompleted / total) * 100) : 0,
    },
  }
}
