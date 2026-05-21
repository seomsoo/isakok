import { useQuery } from '@tanstack/react-query'
import { getPhotosByMove, type PhotoType } from '@/services/photos'
import { photoKeys } from './queryKeys'

export function usePhotos(moveId: string | undefined, photoType: PhotoType, userId: string) {
  return useQuery({
    queryKey: photoKeys.byMove(moveId ?? '', photoType),
    queryFn: () => getPhotosByMove(moveId ?? '', photoType, userId),
    enabled: !!moveId && !!userId,
  })
}
