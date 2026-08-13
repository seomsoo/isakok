import { useQuery } from '@tanstack/react-query'
import { getOverdueItems } from '@/services/checklist'
import { queryKeys } from '@/features/dashboard/hooks/queryKeys'

export function useOverdueItems(moveId: string, userId: string) {
  return useQuery({
    queryKey: queryKeys.overdueItems(moveId),
    queryFn: () => getOverdueItems(moveId, userId),
    enabled: !!moveId && !!userId,
    staleTime: Infinity,
  })
}
