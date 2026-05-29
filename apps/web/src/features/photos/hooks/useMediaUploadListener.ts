import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { sendToNative } from '@moving/shared'
import type { BridgeMessage, NativeToWebMessage, WebToNativeMessage } from '@moving/shared'
import { insertUploadedPhotos } from '@/services/photos'
import { photoKeys } from './queryKeys'
import { useToast } from '@/shared/components/ToastProvider'
import { useUserId } from '@/auth/useSession'

type MediaUploadedPayload = Extract<NativeToWebMessage, { type: 'MEDIA_UPLOADED' }>['payload']
type OpenMediaPickerPayload = Extract<WebToNativeMessage, { type: 'OPEN_MEDIA_PICKER' }>['payload']

/**
 * 네이티브 미디어 피커 왕복 관리 + MEDIA_UPLOADED 수신 → property_photos DB INSERT (ADR-079).
 *
 * 네이티브가 Storage 업로드를 마친 뒤 메타데이터만 전달하면, 웹이 DB INSERT를 담당한다.
 * 사진 페이지(PhotoRoomPage/PhotosPage)에 마운트 — 네이티브 피커 왕복 동안 페이지는 유지된다.
 *
 * - `requestPicker`: 업로드 가드(in-flight)를 세우고 OPEN_MEDIA_PICKER를 전송. 왕복 중에는 재진입 차단
 *   (피커가 끝나기 전 photos.length가 안 바뀌어 같은 maxSelect로 중복 업로드되면 maxCount 초과하던 문제 방지).
 * - 세션 일치 검증: storage_path 첫 세그먼트(userId)가 현재 WebView 세션 userId와 다르면(broadcast race)
 *   INSERT를 보류하고 세션 재주입(REQUEST_SESSION_REFRESH)을 요청한 뒤, 세션이 재주입되면(userId 변경)
 *   보류한 payload를 1회 재시도한다(스펙 §2-3 — 드롭 시 Storage 파일이 orphan으로 남기 때문).
 */
export function useMediaUploadListener() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { userId } = useUserId()

  const [isUploading, setIsUploading] = useState(false)
  // setState는 비동기라 빠른 연타 사이의 경쟁을 막지 못함 → ref로 동기 가드.
  const uploadingRef = useRef(false)
  // 세션 불일치로 보류된 payload(네이티브는 이미 Storage 업로드 완료). 세션 재주입 후 재시도용.
  const pendingRef = useRef<{ payload: MediaUploadedPayload; failedUserId: string } | null>(null)
  // 최신 userId를 message 핸들러에서 참조 (effect 재구독 없이).
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  // payload를 현재 세션 userId로 검증 후 INSERT. 불일치면 'mismatch'(호출자가 보류 처리).
  const processUpload = useCallback(
    async (payload: MediaUploadedPayload, currentUserId: string): Promise<'ok' | 'mismatch'> => {
      const { moveId, room, photoType, items, failed } = payload
      const mismatch = items.some((item) => !item.storage_path.startsWith(`${currentUserId}/`))
      if (mismatch) return 'mismatch'

      let saved = 0
      if (items.length > 0) {
        try {
          saved = await insertUploadedPhotos({
            moveId,
            userId: currentUserId,
            room,
            photoType,
            items,
          })
        } catch (error) {
          console.error('[useMediaUploadListener]', error)
          toast.error('사진 저장에 실패했어요')
          return 'ok'
        }
        queryClient.invalidateQueries({ queryKey: photoKeys.byMove(moveId, photoType) })
      }

      if (failed > 0) toast.error(`${failed}장 저장에 실패했어요`)
      if (saved > 0) toast.success(`${saved}장 저장 완료`)
      return 'ok'
    },
    [queryClient, toast],
  )

  useEffect(() => {
    async function handle(event: MessageEvent) {
      let wrapped: BridgeMessage<NativeToWebMessage>
      try {
        wrapped = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (!wrapped || wrapped.version !== 1 || wrapped.data?.type !== 'MEDIA_UPLOADED') return

      // 피커 왕복 종료 — 취소(빈 items)·실패·성공 모두 여기서 in-flight 가드 해제.
      uploadingRef.current = false
      setIsUploading(false)

      const payload = wrapped.data.payload
      const currentUserId = userIdRef.current
      if (!currentUserId) return

      const result = await processUpload(payload, currentUserId)
      if (result === 'mismatch') {
        pendingRef.current = { payload, failedUserId: currentUserId }
        sendToNative({ type: 'REQUEST_SESSION_REFRESH' })
        toast.error('세션을 다시 확인하고 있어요. 잠시만요')
      }
    }

    window.addEventListener('message', handle)
    return () => window.removeEventListener('message', handle)
  }, [processUpload, toast])

  // 세션이 재주입(userId 변경)되면 보류된 업로드를 1회 재시도. 같은 userId면(아직 미반영) 대기.
  useEffect(() => {
    const pending = pendingRef.current
    if (!userId || !pending || pending.failedUserId === userId) return
    pendingRef.current = null
    void processUpload(pending.payload, userId).then((result) => {
      if (result === 'mismatch') toast.error('세션 불일치로 일부 사진을 저장하지 못했어요')
    })
  }, [userId, processUpload, toast])

  const requestPicker = useCallback((payload: OpenMediaPickerPayload) => {
    if (uploadingRef.current) return
    uploadingRef.current = true
    setIsUploading(true)
    sendToNative({ type: 'OPEN_MEDIA_PICKER', payload })
  }, [])

  return { isUploading, requestPicker }
}
