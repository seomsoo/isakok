import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as Crypto from 'expo-crypto'
import { decode } from 'base64-arraybuffer'
import { getCurrentSession } from '../auth/sessionState'
import { createAuthedClient } from '../auth/supabaseNative'

// 네이티브 미디어 입력 (ADR-079): 카메라/갤러리 → 촬영일시(EXIF) 추출 → 리사이즈·압축 → Storage 직접 업로드.
// 파일은 WebView를 통과하지 않고, 메타데이터(MEDIA_UPLOADED)만 웹으로 회신해 웹이 DB INSERT.
//
// 용량 최적화(무료 티어 스토리지): 긴 변 1920px 다운스케일 + 80% 압축 ≈ 300KB대 (6단계 방식).
// EXIF(촬영일시)는 압축 전에 추출해 DB(taken_at)에 보존 — manipulate는 파일 EXIF를 strip하므로.
// WebP 우선, iOS 등에서 WebP 인코딩 실패 시 JPEG로 폴백(업로드 실패 방지).

const BUCKET = 'property-photos'
const MAX_BYTES = 10 * 1024 * 1024
const MAX_DIMENSION = 1920
const COMPRESS = 0.8

export interface OpenMediaPickerOptions {
  kind: 'camera' | 'gallery'
  multi: boolean
  moveId: string
  room: string
  photoType: 'move_in' | 'move_out'
  maxSelect: number
}

export interface UploadedMediaItem {
  storage_path: string
  taken_at: string | null
  hash: string
}

export interface MediaUploadResult {
  items: UploadedMediaItem[]
  failed: number
  canceled: boolean
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * EXIF DateTimeOriginal("YYYY:MM:DD HH:mm:ss")을 ISO로 변환. 촬영일시는 증거력 핵심이라 압축 전에 보존.
 */
function extractTakenAt(exif: Record<string, unknown> | null | undefined): string | null {
  if (!exif) return null
  const raw = exif.DateTimeOriginal ?? exif.DateTimeDigitized ?? exif.DateTime
  if (typeof raw !== 'string') return null
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * 긴 변 MAX_DIMENSION으로 다운스케일(원본이 더 클 때만) + 압축. WebP 우선, 실패 시 JPEG 폴백.
 * (expo-image-manipulator 신규 컨텍스트 API. 포맷별 재렌더로 WebP 미지원 환경에서도 안전.)
 */
async function compressAsset(
  uri: string,
  resize: { width?: number; height?: number } | null,
): Promise<{ base64: string; ext: string; contentType: string } | null> {
  const formats = [
    { format: SaveFormat.WEBP, ext: 'webp', contentType: 'image/webp' },
    { format: SaveFormat.JPEG, ext: 'jpg', contentType: 'image/jpeg' },
  ]
  for (const f of formats) {
    try {
      const context = ImageManipulator.manipulate(uri)
      if (resize) context.resize(resize)
      const rendered = await context.renderAsync()
      const saved = await rendered.saveAsync({ compress: COMPRESS, format: f.format, base64: true })
      if (saved.base64) return { base64: saved.base64, ext: f.ext, contentType: f.contentType }
    } catch (err) {
      console.warn(
        `[mediaUpload] manipulate(${f.format}) failed:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
  return null
}

async function launchPicker(opts: OpenMediaPickerOptions): Promise<ImagePicker.ImagePickerResult> {
  const mediaTypes: ImagePicker.MediaType[] = ['images']
  if (opts.kind === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) return { canceled: true, assets: null }
    return ImagePicker.launchCameraAsync({ mediaTypes, exif: true, quality: 1 })
  }
  // iOS PHPicker(iOS 14+)는 사진 라이브러리 권한 불필요. Android는 시스템 포토 피커가 권한 처리.
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    exif: true,
    quality: 1,
    allowsMultipleSelection: opts.multi,
    selectionLimit: opts.multi ? Math.max(1, opts.maxSelect) : 1,
  })
}

/**
 * 카메라/갤러리에서 선택한 이미지를 리사이즈·압축 후 Storage에 직접 업로드하고 메타데이터를 반환 (ADR-079).
 * - 경로: {userId}/{moveId}/{room}_{ts}_{i}.{ext} (ADR-057, Storage RLS foldername[1]=auth.uid()).
 * - 다중 선택 부분 실패: 성공분만 items에 담고 실패 수는 failed로 반환(웹이 toast).
 */
export async function pickAndUploadMedia(opts: OpenMediaPickerOptions): Promise<MediaUploadResult> {
  const session = getCurrentSession()
  if (!session) return { items: [], failed: 0, canceled: true }
  const userId = session.user.id

  const result = await launchPicker(opts)
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { items: [], failed: 0, canceled: true }
  }

  const client = createAuthedClient(session.access_token)
  const items: UploadedMediaItem[] = []
  let failed = 0

  for (let i = 0; i < result.assets.length; i++) {
    const asset = result.assets[i]
    if (!asset) {
      failed++
      continue
    }
    try {
      // 촬영일시는 압축 전에 EXIF에서 추출해 DB(taken_at)에 보존
      const takenAt = extractTakenAt(asset.exif)

      // 긴 변이 MAX_DIMENSION 초과일 때만 다운스케일(작은 사진은 확대 안 함). 한 변만 주면 비율 유지.
      const longest = Math.max(asset.width, asset.height)
      const resize =
        longest > MAX_DIMENSION
          ? asset.width >= asset.height
            ? { width: MAX_DIMENSION }
            : { height: MAX_DIMENSION }
          : null

      const compressed = await compressAsset(asset.uri, resize)
      if (!compressed) {
        failed++
        continue
      }

      const buffer = decode(compressed.base64)
      if (buffer.byteLength > MAX_BYTES) {
        failed++
        continue
      }

      const hash = await sha256Hex(buffer)
      const path = `${userId}/${opts.moveId}/${opts.room}_${Date.now()}_${i}.${compressed.ext}`
      const { error } = await client.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: compressed.contentType, upsert: false })
      if (error) {
        console.warn('[mediaUpload] storage upload failed:', error.message)
        failed++
        continue
      }

      items.push({ storage_path: path, taken_at: takenAt, hash })
    } catch (err) {
      console.warn('[mediaUpload] asset failed:', err instanceof Error ? err.message : err)
      failed++
    }
  }

  return { items, failed, canceled: false }
}
