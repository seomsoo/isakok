import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updatePhotoMemo, type PhotoType } from '@/services/photos'
import { photoKeys } from './queryKeys'
import { useToast } from '@/shared/components/ToastProvider'

/**
 * 사진 메모 업데이트 뮤테이션
 * 4단계 MemoSection 패턴 재사용: 디바운스 + in-flight 직렬화는 호출부에서 처리
 */
export function useUpdatePhotoMemo(moveId: string, photoType: PhotoType) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ photoId, memo }: { photoId: string; memo: string }) =>
      updatePhotoMemo(photoId, memo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: photoKeys.byMove(moveId, photoType) })
    },
    onError: () => {
      toast.error('메모 저장에 실패했어요')
    },
  })
}
