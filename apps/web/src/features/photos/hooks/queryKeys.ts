import type { PhotoType } from '@/services/photos'

export const photoKeys = {
  all: ['photos'] as const,
  byMove: (moveId: string, photoType: PhotoType) =>
    [...photoKeys.all, moveId, photoType] as const,
  deleted: (moveId: string, photoType: PhotoType, room: string) =>
    [...photoKeys.all, 'deleted', moveId, photoType, room] as const,
  allDeleted: (moveId: string, photoType: PhotoType) =>
    [...photoKeys.all, 'deleted', moveId, photoType] as const,
  signedUrls: (sortedPaths: string[]) => ['signedUrls', ...sortedPaths] as const,
}
