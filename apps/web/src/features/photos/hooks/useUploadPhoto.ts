import { useMutation } from '@tanstack/react-query'
import { generateFileHash } from '@moving/shared'
import { uploadPhoto, type UploadPhotoParams } from '@/services/photos'
import { extractExifTakenAt } from '../utils/exif'
import { resizeImage } from '../utils/resizeImage'
import { useToast } from '@/shared/components/ToastProvider'

type UploadInput = Omit<UploadPhotoParams, 'imageHash' | 'takenAt'>

/**
 * 사진 업로드 뮤테이션
 *
 * 파이프라인:
 * 1. EXIF 추출 (촬영 일시) + SHA-256 해시 (원본 무결성) 병렬
 * 2. 클라이언트 리사이즈 (긴 변 1920px, WebP 80%)
 * 3. Storage 업로드 + DB 저장
 *
 * 캐시 무효화는 호출 측(handleUpload)에서 배치 완료 후 한 번만 수행.
 * 개별 onSuccess에서 invalidate하면 N장 병렬 업로드 시 쿼리키가 N번 바뀌어
 * signed URL fetch가 반복 취소/재시작되어 스피너가 풀리지 않음.
 */
export function useUploadPhoto() {
  const toast = useToast()

  return useMutation({
    mutationFn: async (params: UploadInput) => {
      const [takenAt, imageHash] = await Promise.all([
        extractExifTakenAt(params.file),
        generateFileHash(params.file),
      ])
      const resizedFile = await resizeImage(params.file)
      return uploadPhoto({ ...params, file: resizedFile, imageHash, takenAt })
    },
    onError: (error) => {
      console.error('[useUploadPhoto]', error)
      toast.error('사진 저장에 실패했어요. 다시 시도해주세요.')
    },
  })
}
