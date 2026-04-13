import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { rescheduleOverdueItems, type UrgencyMode } from '@moving/shared'
import { getDashboardItems } from '@/services/checklist'
import { queryKeys } from './queryKeys'

export function useDashboardItems(moveId: string) {
  return useQuery({
    queryKey: queryKeys.todayItems(moveId),
    queryFn: () => getDashboardItems(moveId),
    enabled: !!moveId,
  })
}

interface MasterLike {
  guide_type?: 'critical' | 'warning' | 'tip'
  is_skippable?: boolean
}

/**
 * 빠듯 모드: 과거 미완료에 display_date 부여 후 overdue → action으로 승격
 * 급한/초급한 모드: 상세페이지 전환은 타임라인에서 처리, 여기선 원본 유지
 */
export function useDashboardItemsWithMode(
  moveId: string,
  mode: UrgencyMode,
  movingDate: string,
) {
  const query = useDashboardItems(moveId)

  const data = useMemo(() => {
    if (!query.data) return query.data
    const { overdue, today, upcoming } = query.data

    if (mode !== 'tight') return query.data

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const mapped = rescheduleOverdueItems(
      overdue.map((item) => ({
        id: item.id as string,
        assigned_date: item.assigned_date as string,
        is_completed: item.is_completed as boolean,
        guide_type:
          ((item.master_checklist_items as MasterLike | null)?.guide_type as
            | 'critical'
            | 'warning'
            | 'tip') ?? 'tip',
      })),
      todayStr,
      movingDate,
    )
    const displayMap = new Map(mapped.map((r) => [r.id, r.display_date]))

    const rescheduledOverdue = overdue.map((item) => ({
      ...item,
      display_date: displayMap.get(item.id as string) ?? item.assigned_date,
    }))

    return { overdue: rescheduledOverdue, today, upcoming }
  }, [query.data, mode, movingDate])

  return { ...query, data }
}
