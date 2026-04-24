import { useMutation, useQueryClient } from '@tanstack/react-query'
import { restorePhoto, type PhotoType } from '@/services/photos'
import { photoKeys } from './queryKeys'
import { useToast } from '@/shared/components/ToastProvider'

export function useRestorePhoto(moveId: string, photoType: PhotoType, room: string) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: restorePhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: photoKeys.byMove(moveId, photoType) })
      queryClient.invalidateQueries({ queryKey: photoKeys.deleted(moveId, photoType, room) })
      queryClient.invalidateQueries({ queryKey: photoKeys.allDeleted(moveId, photoType) })
      toast.success('사진을 복구했어요')
    },
    onError: (error) => {
      console.error('[useRestorePhoto]', error)
      toast.error('복구에 실패했어요. 다시 시도해주세요.')
    },
  })
}
