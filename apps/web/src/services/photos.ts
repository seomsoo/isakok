import { supabase } from '@/lib/supabase'
import type { Tables } from '@shared/types/database'

export type PropertyPhoto = Tables<'property_photos'>
export type PhotoType = 'move_in' | 'move_out'

const BUCKET = 'property-photos'
const SIGNED_URL_EXPIRY_SEC = 3600 // 1시간

/**
 * 이사 건의 사진 목록 조회 (soft delete 제외)
 * @param moveId - 이사 ID
 * @param photoType - 입주/퇴실 구분
 * @param userId - 소유자 ID (user_id 필터)
 * @throws 쿼리 에러 시 [getPhotosByMove] 접두사와 함께 throw
 */
export async function getPhotosByMove(
  moveId: string,
  photoType: PhotoType,
  userId: string,
): Promise<PropertyPhoto[]> {
  const { data, error } = await supabase
    .from('property_photos')
    .select('*')
    .eq('move_id', moveId)
    .eq('photo_type', photoType)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('room')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`[getPhotosByMove] ${error.message}`)
  return data ?? []
}

/**
 * Storage signed URL 생성 (단일)
 * property-photos 버킷은 private이므로 DB에는 storage_path만 저장
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SEC)

  if (error) throw new Error(`[getSignedUrl] ${error.message}`)
  return data.signedUrl
}

/**
 * 여러 사진의 signed URL 일괄 생성 (path → signedUrl Record)
 * Supabase JS v2의 createSignedUrls(복수형) 사용 → API 1회로 N개 URL 획득
 * @param userId - 소유자 ID (prefix ownership 가드)
 */
export async function getSignedUrls(
  storagePaths: string[],
  userId: string,
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {}

  for (const path of storagePaths) {
    if (!path.startsWith(`${userId}/`)) {
      throw new Error('[getSignedUrls] storagePath ownership mismatch')
    }
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(storagePaths, SIGNED_URL_EXPIRY_SEC)

  if (error) throw new Error(`[getSignedUrls] ${error.message}`)

  const urlRecord: Record<string, string> = {}
  data?.forEach((item) => {
    if (item.signedUrl && item.path) {
      urlRecord[item.path] = item.signedUrl
    }
  })
  return urlRecord
}

export interface UploadedPhotoItem {
  storage_path: string
  taken_at: string | null
  hash: string
}

export interface InsertUploadedPhotosParams {
  moveId: string
  userId: string
  room: string
  photoType: PhotoType
  items: UploadedPhotoItem[]
}

/**
 * 네이티브가 Storage에 직접 업로드한 사진들의 DB 행을 INSERT (ADR-079).
 *
 * 하이브리드 앱에서 파일은 WebView를 통과하지 않음 → 네이티브가 EXIF·SHA-256 추출 + Storage 업로드를
 * 완료하고, 웹은 메타데이터만 받아 property_photos에 기록한다. (기존 uploadPhoto의 DB INSERT 부분만 재사용)
 *
 * 경로 규칙(네이티브 생성): {userId}/{moveId}/{room}_{timestamp} → Storage RLS(foldername[1]=auth.uid()).
 * 호출 전 storage_path의 userId가 현재 세션 userId와 일치하는지 검증할 것(orphan/RLS 실패 방지).
 *
 * @param params - moveId, userId(소유자), room, photoType, items(storage_path/taken_at/hash)
 * @returns INSERT된 행 수
 * @throws 쿼리 에러 시 [insertUploadedPhotos] 접두사와 함께 throw
 */
export async function insertUploadedPhotos(params: InsertUploadedPhotosParams): Promise<number> {
  const { moveId, userId, room, photoType, items } = params
  if (items.length === 0) return 0

  const now = new Date().toISOString()
  const rows = items.map((item) => ({
    move_id: moveId,
    user_id: userId,
    photo_type: photoType,
    room,
    storage_path: item.storage_path,
    image_hash: item.hash,
    memo: null,
    taken_at: item.taken_at,
    uploaded_at: now,
  }))

  const { error } = await supabase.from('property_photos').insert(rows)
  if (error) throw new Error(`[insertUploadedPhotos] ${error.message}`)
  return rows.length
}

/**
 * 사진 soft delete (deleted_at 설정). Storage 파일은 보존 → 복구 가능.
 * @param photoId - 사진 ID
 * @param userId - 소유자 ID (user_id 필터)
 * @throws 쿼리 에러 시 [softDeletePhoto] 접두사와 함께 throw
 */
export async function softDeletePhoto(photoId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('property_photos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', photoId)
    .eq('user_id', userId)

  if (error) throw new Error(`[softDeletePhoto] ${error.message}`)
}

/**
 * 삭제된 사진 조회 (방별, deleted_at 최신순)
 * @param moveId - 이사 ID
 * @param photoType - 입주/퇴실 구분
 * @param room - 방 타입
 * @param userId - 소유자 ID (user_id 필터)
 * @throws 쿼리 에러 시 [getDeletedPhotos] 접두사와 함께 throw
 */
export async function getDeletedPhotos(
  moveId: string,
  photoType: PhotoType,
  room: string,
  userId: string,
): Promise<PropertyPhoto[]> {
  const { data, error } = await supabase
    .from('property_photos')
    .select('*')
    .eq('move_id', moveId)
    .eq('photo_type', photoType)
    .eq('room', room)
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) throw new Error(`[getDeletedPhotos] ${error.message}`)
  return data ?? []
}

/**
 * 삭제된 사진 전체 조회 (모든 방, deleted_at 최신순)
 * @param moveId - 이사 ID
 * @param photoType - 입주/퇴실 구분
 * @param userId - 소유자 ID (user_id 필터)
 * @throws 쿼리 에러 시 [getAllDeletedPhotos] 접두사와 함께 throw
 */
export async function getAllDeletedPhotos(
  moveId: string,
  photoType: PhotoType,
  userId: string,
): Promise<PropertyPhoto[]> {
  const { data, error } = await supabase
    .from('property_photos')
    .select('*')
    .eq('move_id', moveId)
    .eq('photo_type', photoType)
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) throw new Error(`[getAllDeletedPhotos] ${error.message}`)
  return data ?? []
}

/**
 * 사진 복구 (deleted_at → null)
 * @param photoId - 사진 ID
 * @param userId - 소유자 ID (user_id 필터)
 * @throws 쿼리 에러 시 [restorePhoto] 접두사와 함께 throw
 */
export async function restorePhoto(photoId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('property_photos')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq('id', photoId)
    .eq('user_id', userId)

  if (error) throw new Error(`[restorePhoto] ${error.message}`)
}

/**
 * 영구삭제 (Storage 파일 삭제 + DB 행 삭제)
 * @param photoId - 사진 ID
 * @param storagePath - Storage 경로
 * @param userId - 소유자 ID (user_id 필터)
 * @throws 쿼리 에러 시 [hardDeletePhoto] 접두사와 함께 throw
 */
export async function hardDeletePhoto(
  photoId: string,
  storagePath: string,
  userId: string,
): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (storageError) throw new Error(`[hardDeletePhoto:storage] ${storageError.message}`)

  const { error } = await supabase
    .from('property_photos')
    .delete()
    .eq('id', photoId)
    .eq('user_id', userId)

  if (error) throw new Error(`[hardDeletePhoto:db] ${error.message}`)
}

/**
 * 사진 메모 업데이트
 * @param photoId - 사진 ID
 * @param userId - 소유자 ID (user_id 필터)
 * @param memo - 저장할 메모 (빈 문자열 허용)
 * @throws 쿼리 에러 시 [updatePhotoMemo] 접두사와 함께 throw
 */
export async function updatePhotoMemo(
  photoId: string,
  userId: string,
  memo: string,
): Promise<void> {
  const { error } = await supabase
    .from('property_photos')
    .update({ memo, updated_at: new Date().toISOString() })
    .eq('id', photoId)
    .eq('user_id', userId)

  if (error) throw new Error(`[updatePhotoMemo] ${error.message}`)
}
