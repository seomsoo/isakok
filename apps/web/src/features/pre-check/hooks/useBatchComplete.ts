import { useMutation, useQueryClient } from '@tanstack/react-query'
import { batchCompleteItems } from '@/services/checklist'
import { queryKeys } from '@/features/dashboard/hooks/queryKeys'

export function useBatchComplete(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemIds: string[]) => batchCompleteItems(itemIds, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklistAll })
    },
  })
}
