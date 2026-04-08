import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toggleChecklistItem } from '@/services/checklist'
import { queryKeys } from './queryKeys'

export function useToggleItem(moveId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) =>
      toggleChecklistItem(itemId, moveId, isCompleted),

    onMutate: async ({ itemId, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.todayItems(moveId) })
      await queryClient.cancelQueries({ queryKey: queryKeys.timelineItems(moveId) })

      const previousToday = queryClient.getQueryData(queryKeys.todayItems(moveId))
      const previousTimeline = queryClient.getQueryData(queryKeys.timelineItems(moveId))

      queryClient.setQueryData(
        queryKeys.todayItems(moveId),
        (old: { today: Record<string, unknown>[]; overdue: Record<string, unknown>[]; upcoming: Record<string, unknown>[] } | undefined) => {
          if (!old) return old
          const toggleItem = (item: Record<string, unknown>) =>
            item.id === itemId
              ? {
                  ...item,
                  is_completed: isCompleted,
                  completed_at: isCompleted ? new Date().toISOString() : null,
                }
              : item
          return {
            overdue: old.overdue.map(toggleItem),
            today: old.today.map(toggleItem),
            upcoming: old.upcoming.map(toggleItem),
          }
        },
      )

      queryClient.setQueryData(
        queryKeys.timelineItems(moveId),
        (old: Record<string, unknown>[] | undefined) => {
          if (!old) return old
          return old.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  is_completed: isCompleted,
                  completed_at: isCompleted ? new Date().toISOString() : null,
                }
              : item,
          )
        },
      )

      return { previousToday, previousTimeline }
    },

    onError: (_err, _vars, context) => {
      if (context?.previousToday) {
        queryClient.setQueryData(queryKeys.todayItems(moveId), context.previousToday)
      }
      if (context?.previousTimeline) {
        queryClient.setQueryData(queryKeys.timelineItems(moveId), context.previousTimeline)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todayItems(moveId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.timelineItems(moveId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.currentMove })
    },
  })
}
