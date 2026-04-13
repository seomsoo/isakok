import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateItemMemo } from '@/services/checklist'
import { queryKeys } from '@/features/dashboard/hooks/queryKeys'

export function useUpdateMemo(itemId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memo: string) => updateItemMemo(itemId, memo),

    onMutate: async (newMemo) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.itemDetail(itemId) })
      const previous = queryClient.getQueryData(queryKeys.itemDetail(itemId))

      queryClient.setQueryData(
        queryKeys.itemDetail(itemId),
        (old: Record<string, unknown> | undefined) => {
          if (!old) return old
          return { ...old, memo: newMemo }
        },
      )
      return { previous }
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.itemDetail(itemId), context.previous)
      }
    },
  })
}
