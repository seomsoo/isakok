/**
 * Supabase 자동 생성 필드 (모든 테이블 공통)
 * DB 응답에는 포함, 생성 요청에는 제외
 */
export interface TimestampFields {
  created_at: string
  updated_at: string
}

/**
 * soft delete 가능 테이블 공통 (moves, property_photos)
 */
export interface SoftDeletable {
  deleted_at: string | null
}
