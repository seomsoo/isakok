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

export function useTimelineItems(moveId: string, movingDate: string) {
  return useQuery({
    queryKey: queryKeys.timelineItems(moveId),
    queryFn: () => getTimelineItems(moveId),
    enabled: !!moveId && !!movingDate,
    select: (data) => groupByPeriod(data, movingDate),
  })
}

/**
 * 날짜 라벨 생성
 * 스펙 8-2: 오늘/내일/이사 전날/이사 당일/이사 후 N일/M월 d일 (E)
 */
export function getDateLabel(
  assignedDate: string,
  movingDate: string,
): string {
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

function groupByPeriod(
  items: Record<string, unknown>[],
  movingDate: string,
): TimelinePeriods {
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

  // 기간 정의
  const periods = new Map<string, { label: string; isCurrent: boolean; items: Record<string, unknown>[]; overdueItems: Record<string, unknown>[] }>()

  const thisWeekLabel = movingIsThisWeek ? '이번 주 (이사 주)' : '이번 주'
  periods.set(PERIOD_KEYS.THIS_WEEK, { label: thisWeekLabel, isCurrent: true, items: [], overdueItems: [] })

  if (!movingIsThisWeek) {
    const nextWeekLabel = movingIsNextWeek ? '다음 주 (이사 주)' : '다음 주'
    periods.set(PERIOD_KEYS.NEXT_WEEK, { label: nextWeekLabel, isCurrent: false, items: [], overdueItems: [] })
  }

  if (!movingIsThisWeek && !movingIsNextWeek) {
    periods.set(PERIOD_KEYS.MOVING_WEEK, { label: '이사 주', isCurrent: false, items: [], overdueItems: [] })
  }

  periods.set(PERIOD_KEYS.AFTER_MOVE, { label: '이사 후', isCurrent: false, items: [], overdueItems: [] })

  // 완료된 항목 분리
  const completedItems: Record<string, unknown>[] = []

  // 항목 분류
  for (const item of items) {
    const assignedDate = parseISO(item.assigned_date as string)
    const isCompleted = item.is_completed as boolean

    // 완료 항목 → CompletedSection으로
    if (isCompleted) {
      completedItems.push(item)
      continue
    }

    // 밀린 항목: 이번 주 시작 이전 + 미완료 → 이번 주 overdueItems
    if (isBefore(assignedDate, thisWeekStart)) {
      periods.get(PERIOD_KEYS.THIS_WEEK)?.overdueItems.push(item)
      continue
    }

    // 이번 주
    if (isWithinInterval(assignedDate, { start: thisWeekStart, end: thisWeekEnd })) {
      periods.get(PERIOD_KEYS.THIS_WEEK)?.items.push(item)
      continue
    }

    // 다음 주
    if (isWithinInterval(assignedDate, { start: nextWeekStart, end: nextWeekEnd })) {
      const targetKey = movingIsThisWeek ? PERIOD_KEYS.AFTER_MOVE : PERIOD_KEYS.NEXT_WEEK
      periods.get(targetKey)?.items.push(item)
      continue
    }

    // 이사일 이후
    if (isAfter(assignedDate, movingDay)) {
      periods.get(PERIOD_KEYS.AFTER_MOVE)?.items.push(item)
      continue
    }

    // 다음 주 ~ 이사 주 사이 → 이사 주에 포함
    if (movingIsThisWeek) {
      periods.get(PERIOD_KEYS.THIS_WEEK)?.items.push(item)
    } else if (movingIsNextWeek) {
      periods.get(PERIOD_KEYS.NEXT_WEEK)?.items.push(item)
    } else if (isWithinInterval(assignedDate, { start: movingWeekStart, end: movingWeekEnd }) ||
               (isAfter(assignedDate, nextWeekEnd) && !isAfter(assignedDate, movingDay))) {
      periods.get(PERIOD_KEYS.MOVING_WEEK)?.items.push(item)
    }
  }

  // 밀린 항목 긴급도순 정렬
  const thisWeekPeriod = periods.get(PERIOD_KEYS.THIS_WEEK)
  if (thisWeekPeriod) {
    thisWeekPeriod.overdueItems.sort((a, b) => {
      const masterA = a.master_checklist_items as Record<string, unknown> | null
      const masterB = b.master_checklist_items as Record<string, unknown> | null
      return (GUIDE_PRIORITY[masterA?.guide_type as string] ?? 3) -
             (GUIDE_PRIORITY[masterB?.guide_type as string] ?? 3)
    })
  }

  // 빈 기간 제거 + PeriodGroup 변환
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

  // 전체 진행률
  const totalCompleted = completedItems.length
  const total = items.length

  return {
    periods: result,
    completedItems,
    currentIndex,
    progress: {
      completed: totalCompleted,
      total,
      percentage: total > 0 ? Math.round((totalCompleted / total) * 100) : 0,
    },
  }
}
