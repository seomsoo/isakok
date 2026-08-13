import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type UrgencyMode } from '@moving/shared'
import {
  getDashboardItems,
  type DashboardItems,
  type RescheduledChecklistItem,
} from '@/services/checklist'
import { computeOverdueDisplayDates } from '@/shared/utils/overdueDisplayDates'
import { queryKeys } from './queryKeys'

function useDashboardItems(moveId: string, userId: string) {
  return useQuery({
    queryKey: queryKeys.todayItems(moveId),
    queryFn: () => getDashboardItems(moveId, userId),
    enabled: !!moveId && !!userId,
  })
}

/**
 * 빠듯 모드: 과거 미완료에 display_date 부여 후 overdue → action으로 승격
 * 급한/초급한 모드: 상세페이지 전환은 타임라인에서 처리, 여기선 원본 유지
 */
export function useDashboardItemsWithMode(
  moveId: string,
  userId: string,
  mode: UrgencyMode,
  movingDate: string,
) {
  const query = useDashboardItems(moveId, userId)

  const data = useMemo<
    (Omit<DashboardItems, 'overdue'> & { overdue: RescheduledChecklistItem[] }) | undefined
  >(() => {
    if (!query.data) return query.data
    const { overdue, today, upcoming } = query.data

    if (mode !== 'tight') return query.data

    const displayMap = computeOverdueDisplayDates(overdue, movingDate)

    const rescheduledOverdue = overdue.map((item) => ({
      ...item,
      display_date: displayMap.get(item.id) ?? item.assigned_date,
    }))

    return { overdue: rescheduledOverdue, today, upcoming }
  }, [query.data, mode, movingDate])

  return { ...query, data }
}
