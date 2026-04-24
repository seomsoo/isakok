import { supabase } from '@/lib/supabase'
import type { Tables } from '@shared/types/database'

export type PropertyPhoto = Tables<'property_photos'>
export type PhotoType = 'move_in' | 'move_out'

const BUCKET = 'property-photos'
const SIGNED_URL_EXPIRY_SEC = 3600 // 1시간

/**
 * 이사 건의 사진 목록 조회 (soft delete 제외)
 */
export async function getPhotosByMove(
  moveId: string,
  photoType: PhotoType,
): Promise<PropertyPhoto[]> {
  const { data, error } = await supabase
    .from('property_photos')
    .select('*')
    .eq('move_id', moveId)
    .eq('photo_type', photoType)
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
 */
export async function getSignedUrls(
  storagePaths: string[],
): Promise<Record<string, string>> {
  if (storagePaths.length === 0) return {}

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

export interface UploadPhotoParams {
  moveId: string
  userId: string
  file: File
  room: string
  photoType: PhotoType
  memo?: string
  imageHash: string
  takenAt?: Date | null
}

/**
 * 사진 업로드: Storage → DB 2단계 프로세스
 *
 * 왜 2단계인가?
 * - Storage ≠ PostgreSQL, 트랜잭션으로 묶을 수 없음
 * - DB 실패 시 Storage 파일 정리 시도 (best effort)로 orphan 최소화
 *
 * 경로 규칙: {moveId}/{photoType}/{room}_{timestamp}.{ext}
 * - userId 대신 moveId 기반: 8단계 인증 도입 시 경로 마이그레이션 불필요
 */
export async function uploadPhoto(params: UploadPhotoParams): Promise<PropertyPhoto> {
  const { moveId, userId, file, room, photoType, memo, imageHash, takenAt } = params

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const timestamp = Date.now()
  const storagePath = `${moveId}/${photoType}/${room}_${timestamp}.${ext}`

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })

  if (storageError) throw new Error(`[uploadPhoto:storage] ${storageError.message}`)

  const { data, error: dbError } = await supabase
    .from('property_photos')
    .insert({
      move_id: moveId,
      user_id: userId,
      photo_type: photoType,
      room,
      storage_path: storagePath,
      image_hash: imageHash,
      memo: memo || null,
      taken_at: takenAt ? takenAt.toISOString() : null,
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (dbError) {
    // best effort: Storage 파일 정리 (실패해도 throw는 원래 DB 에러)
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw new Error(`[uploadPhoto:db] ${dbError.message}`)
  }

  return data
}

/**
 * 사진 soft delete (deleted_at 설정). Storage 파일은 보존 → 복구 가능.
 */
export async function softDeletePhoto(photoId: string): Promise<void> {
  const { error } = await supabase
    .from('property_photos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', photoId)

  if (error) throw new Error(`[softDeletePhoto] ${error.message}`)
}

/**
 * 삭제된 사진 조회 (방별, deleted_at 최신순)
 */
export async function getDeletedPhotos(
  moveId: string,
  photoType: PhotoType,
  room: string,
): Promise<PropertyPhoto[]> {
  const { data, error } = await supabase
    .from('property_photos')
    .select('*')
    .eq('move_id', moveId)
    .eq('photo_type', photoType)
    .eq('room', room)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) throw new Error(`[getDeletedPhotos] ${error.message}`)
  return data ?? []
}

/**
 * 삭제된 사진 전체 조회 (모든 방, deleted_at 최신순)
 */
export async function getAllDeletedPhotos(
  moveId: string,
  photoType: PhotoType,
): Promise<PropertyPhoto[]> {
  const { data, error } = await supabase
    .from('property_photos')
    .select('*')
    .eq('move_id', moveId)
    .eq('photo_type', photoType)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) throw new Error(`[getAllDeletedPhotos] ${error.message}`)
  return data ?? []
}

/**
 * 사진 복구 (deleted_at → null)
 */
export async function restorePhoto(photoId: string): Promise<void> {
  const { error } = await supabase
    .from('property_photos')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq('id', photoId)

  if (error) throw new Error(`[restorePhoto] ${error.message}`)
}

/**
 * 영구삭제 (Storage 파일 삭제 + DB 행 삭제)
 */
export async function hardDeletePhoto(photoId: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (storageError) throw new Error(`[hardDeletePhoto:storage] ${storageError.message}`)

  const { error } = await supabase
    .from('property_photos')
    .delete()
    .eq('id', photoId)

  if (error) throw new Error(`[hardDeletePhoto:db] ${error.message}`)
}

/**
 * 사진 메모 업데이트
 */
export async function updatePhotoMemo(photoId: string, memo: string): Promise<void> {
  const { error } = await supabase
    .from('property_photos')
    .update({ memo, updated_at: new Date().toISOString() })
    .eq('id', photoId)

  if (error) throw new Error(`[updatePhotoMemo] ${error.message}`)
}
