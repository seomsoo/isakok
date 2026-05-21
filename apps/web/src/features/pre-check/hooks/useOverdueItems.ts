import { useQuery } from '@tanstack/react-query'
import { getOverdueItems } from '@/services/checklist'

export function useOverdueItems(moveId: string, userId: string) {
  return useQuery({
    queryKey: ['checklist', 'overdue', moveId],
    queryFn: () => getOverdueItems(moveId, userId),
    enabled: !!moveId && !!userId,
    staleTime: Infinity,
  })
}
