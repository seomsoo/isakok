import { PHOTO_TYPES, type PhotoType } from '@shared/types/photo'

/** ?type= 파싱: 유효하지 않으면 null (기본값 정책은 호출부 결정) */
export function parsePhotoType(raw: string | null): PhotoType | null {
  return raw === PHOTO_TYPES.MOVE_IN || raw === PHOTO_TYPES.MOVE_OUT ? raw : null
}

export function photosPath(type: PhotoType): string {
  return `/photos?type=${type}`
}

export function photoRoomPath(room: string, type: PhotoType): string {
  return `/photos/${room}?type=${type}`
}

export function photoReportPath(type: PhotoType): string {
  return `/photos/report?type=${type}`
}

export function photoTrashPath(type: PhotoType): string {
  return `/photos/trash?type=${type}`
}
