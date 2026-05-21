import { useMutation, useQueryClient } from '@tanstack/react-query'
import { batchCompleteItems } from '@/services/checklist'

export function useBatchComplete(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemIds: string[]) => batchCompleteItems(itemIds, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist'] })
    },
  })
}
