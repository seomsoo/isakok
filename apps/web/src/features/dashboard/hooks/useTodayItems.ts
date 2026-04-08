import { useQuery } from '@tanstack/react-query'
import { getDashboardItems } from '@/services/checklist'
import { queryKeys } from './queryKeys'

export function useDashboardItems(moveId: string) {
  return useQuery({
    queryKey: queryKeys.todayItems(moveId),
    queryFn: () => getDashboardItems(moveId),
    enabled: !!moveId,
  })
}
