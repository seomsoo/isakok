import { useQuery } from '@tanstack/react-query'
import { getPhotosByMove, type PhotoType } from '@/services/photos'
import { photoKeys } from './queryKeys'

export function usePhotos(moveId: string | undefined, photoType: PhotoType) {
  return useQuery({
    queryKey: photoKeys.byMove(moveId ?? '', photoType),
    queryFn: () => getPhotosByMove(moveId ?? '', photoType),
    enabled: !!moveId,
  })
}
