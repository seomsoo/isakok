import { useMutation, useQueryClient } from '@tanstack/react-query'
import { batchCompleteItems } from '@/services/checklist'

export function useBatchComplete() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemIds: string[]) => batchCompleteItems(itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist'] })
    },
  })
}
