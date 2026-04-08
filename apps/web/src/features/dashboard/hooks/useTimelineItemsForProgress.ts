import { useQuery } from '@tanstack/react-query'
import { getTimelineItems } from '@/services/checklist'
import { queryKeys } from './queryKeys'

/**
 * 전체 체크리스트 항목 조회 (진행률 계산용)
 * DdayCard의 CircularProgress에 completed/total을 표시하기 위해 사용
 */
export function useTimelineItemsForProgress(moveId: string) {
  return useQuery({
    queryKey: queryKeys.timelineItems(moveId),
    queryFn: () => getTimelineItems(moveId),
    enabled: !!moveId,
  })
}
