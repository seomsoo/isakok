import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  softDeletePhoto,
  getDeletedPhotos,
  hardDeletePhoto,
  type PhotoType,
  type PropertyPhoto,
} from '@/services/photos'
import { photoKeys } from './queryKeys'
import { useToast } from '@/shared/components/ToastProvider'

const MAX_DELETED_PER_ROOM = 3

/**
 * 사진 soft delete 뮤테이션 (낙관적 업데이트)
 * 방별 최근 삭제 3개 초과 시 가장 오래된 것 영구삭제
 */
export function useDeletePhoto(moveId: string, photoType: PhotoType, room: string) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: softDeletePhoto,
    onMutate: async (photoId: string) => {
      const key = photoKeys.byMove(moveId, photoType)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PropertyPhoto[]>(key)
      queryClient.setQueryData<PropertyPhoto[]>(key, (old) =>
        (old ?? []).filter((p) => p.id !== photoId),
      )
      return { previous }
    },
    onError: (_err, _photoId, context) => {
      const key = photoKeys.byMove(moveId, photoType)
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous)
      }
      toast.error('삭제에 실패했어요. 다시 시도해주세요.')
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: photoKeys.byMove(moveId, photoType) })
      queryClient.invalidateQueries({ queryKey: photoKeys.deleted(moveId, photoType, room) })
      queryClient.invalidateQueries({ queryKey: photoKeys.allDeleted(moveId, photoType) })

      const deleted = await getDeletedPhotos(moveId, photoType, room)
      if (deleted.length > MAX_DELETED_PER_ROOM) {
        const toRemove = deleted.slice(MAX_DELETED_PER_ROOM)
        await Promise.allSettled(
          toRemove.map((p) => hardDeletePhoto(p.id, p.storage_path)),
        )
        queryClient.invalidateQueries({ queryKey: photoKeys.deleted(moveId, photoType, room) })
        queryClient.invalidateQueries({ queryKey: photoKeys.allDeleted(moveId, photoType) })
      }
    },
  })
}

export { MAX_DELETED_PER_ROOM }
