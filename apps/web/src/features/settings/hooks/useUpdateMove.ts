import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateMoveWithReschedule } from '@/services/settings'
import { queryKeys } from '@/features/dashboard/hooks/queryKeys'
import { useToast } from '@/shared/components/ToastProvider'

export function useUpdateMove() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: updateMoveWithReschedule,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.currentMove })
      queryClient.invalidateQueries({ queryKey: queryKeys.todayItems(variables.moveId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.timelineItems(variables.moveId) })
      toast.success('이사 정보가 수정되었어요')
    },
    onError: (error) => {
      console.error('이사 정보 수정 실패:', error)
      toast.error('이사 정보 수정에 실패했어요')
    },
  })
}
