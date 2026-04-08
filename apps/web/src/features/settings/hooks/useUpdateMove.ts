import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateMoveWithReschedule } from '@/services/settings'
import { queryKeys } from '@/features/dashboard/hooks/queryKeys'

export function useUpdateMove() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateMoveWithReschedule,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.currentMove })
      queryClient.invalidateQueries({ queryKey: queryKeys.todayItems(variables.moveId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.timelineItems(variables.moveId) })
    },
    onError: (error) => {
      console.error('이사 정보 수정 실패:', error)
    },
  })
}
