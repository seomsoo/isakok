import { useQuery } from '@tanstack/react-query'
import { getChecklistItemDetail } from '@/services/checklist'
import { queryKeys } from '@/features/dashboard/hooks/queryKeys'

export function useChecklistItemDetail(itemId: string | undefined, userId: string) {
  return useQuery({
    queryKey: itemId ? queryKeys.itemDetail(itemId) : ['checklist', 'detail', 'noop'],
    queryFn: () => getChecklistItemDetail(itemId as string, userId),
    enabled: !!itemId && !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
