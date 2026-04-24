import { useQuery } from '@tanstack/react-query'
import { getDeletedPhotos, type PhotoType } from '@/services/photos'
import { photoKeys } from './queryKeys'

export function useDeletedPhotos(moveId: string, photoType: PhotoType, room: string) {
  return useQuery({
    queryKey: photoKeys.deleted(moveId, photoType, room),
    queryFn: () => getDeletedPhotos(moveId, photoType, room),
    enabled: !!moveId,
  })
}
