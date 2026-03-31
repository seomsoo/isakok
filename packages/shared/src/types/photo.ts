/**
 * 사진 유형 (입주/퇴실)
 * DB: property_photos.photo_type CHECK 제약조건
 */
export const PHOTO_TYPES = {
  MOVE_IN: 'move_in',
  MOVE_OUT: 'move_out',
} as const

export type PhotoType = (typeof PHOTO_TYPES)[keyof typeof PHOTO_TYPES]

/**
 * 방 목록 (6개 고정)
 * DB: property_photos.room CHECK 제약조건
 * "기타" 선택 시 location_detail 컬럼에 자유 입력
 */
export const ROOMS = {
  ENTRANCE: 'entrance',
  ROOM: 'room',
  BATHROOM: 'bathroom',
  KITCHEN: 'kitchen',
  BALCONY: 'balcony',
  OTHER: 'other',
} as const

export type RoomType = (typeof ROOMS)[keyof typeof ROOMS]

/**
 * 방 한글 라벨 (UI 표시용)
 */
export const ROOM_LABELS: Record<RoomType, string> = {
  entrance: '현관',
  room: '방',
  bathroom: '화장실',
  kitchen: '주방',
  balcony: '베란다',
  other: '기타',
} as const
