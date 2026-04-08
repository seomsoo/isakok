import { useQuery } from '@tanstack/react-query'
import { getOverdueItems } from '@/services/checklist'

export function useOverdueItems(moveId: string) {
  return useQuery({
    queryKey: ['checklist', 'overdue', moveId],
    queryFn: () => getOverdueItems(moveId),
    enabled: !!moveId,
    staleTime: Infinity,
  })
}
