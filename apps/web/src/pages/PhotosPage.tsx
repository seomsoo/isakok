import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { ROOM_META, ROUTES, sendToNative } from '@moving/shared'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { usePhotos } from '@/features/photos/hooks/usePhotos'
import { useSignedUrls } from '@/features/photos/hooks/useSignedUrls'
import { useMediaUploadListener } from '@/features/photos/hooks/useMediaUploadListener'
import { PhotoTopTabs } from '@/features/photos/components/PhotoTopTabs'
import { PhotoInfoBanner } from '@/features/photos/components/PhotoInfoBanner'
import { RoomSection } from '@/features/photos/components/RoomSection'
import { DevTabBar } from '@/shared/components/DevTabBar'
import { Skeleton } from '@/shared/components/Skeleton'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { useToast } from '@/shared/components/ToastProvider'
import { useUserId } from '@/auth/useSession'
import { captureEvent, ANALYTICS_EVENTS } from '@/observability/events'
import type { PhotoType } from '@/services/photos'

export function PhotosPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const { userId, isAnonymous } = useUserId()

  const { data: move, isPending } = useCurrentMove()

  const daysUntilMove = move ? differenceInCalendarDays(parseISO(move.moving_date), new Date()) : 0
  const queryType = searchParams.get('type') as PhotoType | null
  const photoType: PhotoType =
    queryType === 'move_in' || queryType === 'move_out'
      ? queryType
      : daysUntilMove > 0
        ? 'move_out'
        : 'move_in'

  const {
    data: photos = [],
    isLoading,
    isError,
    refetch,
  } = usePhotos(move?.id, photoType, userId ?? '')

  // 네이티브가 Storage 업로드를 마치면 MEDIA_UPLOADED 수신 → DB INSERT (ADR-079).
  // requestPicker가 in-flight 가드를 들고 OPEN_MEDIA_PICKER 전송 (왕복 중 중복 업로드 차단).
  const { requestPicker } = useMediaUploadListener()

  const photosByRoom = new Map<string, typeof photos>()
  for (const p of photos) {
    const list = photosByRoom.get(p.room) ?? []
    list.push(p)
    photosByRoom.set(p.room, list)
  }
  const previewPaths = ROOM_META.flatMap((r) =>
    (photosByRoom.get(r.type) ?? []).map((p) => p.storage_path),
  )
  const { data: urlMap } = useSignedUrls(previewPaths, userId ?? '')

  if (isPending) {
    return (
      <main className="min-h-dvh bg-neutral pb-20">
        <div className="mx-5 mt-3">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="mx-5 h-[120px] rounded-2xl" />
          ))}
        </div>
      </main>
    )
  }
  if (!move) return <Navigate to={ROUTES.LANDING} replace />

  function handleAddTrigger(room: string) {
    // 사진 저장 게이트(ADR-074): 익명이면 파일 선택 전에 로그인 요청
    if (isAnonymous) {
      // analytics source = 게이트가 뜬 화면(전환율 join 키). 네이티브 payload의 source('photo_gate')와 별개.
      captureEvent(ANALYTICS_EVENTS.PHOTO_GATE_LOGIN_CLICKED, { source: 'photos_list' })
      sendToNative({ type: 'REQUEST_LOGIN', payload: { source: 'photo_gate' } })
      return
    }
    if (!move) return
    const roomMeta = ROOM_META.find((r) => r.type === room)
    const maxCount = roomMeta?.maxCount ?? 6
    const remaining = maxCount - (photosByRoom.get(room) ?? []).length
    if (remaining <= 0) {
      toast.error(`최대 ${maxCount}장까지 저장할 수 있어요`)
      return
    }
    // 회원: 네이티브 갤러리 피커 요청 (ADR-079). 네이티브가 업로드 후 MEDIA_UPLOADED 회신
    requestPicker({
      kind: 'gallery',
      multi: true,
      moveId: move.id,
      room,
      photoType,
      maxSelect: remaining,
    })
  }

  function handleTypeChange(next: PhotoType) {
    navigate(`/photos?type=${next}`, { replace: true })
  }

  return (
    <main className="min-h-dvh bg-neutral pb-24">
      <PhotoTopTabs value={photoType} onChange={handleTypeChange} />

      <div className="mt-4">
        <PhotoInfoBanner photoType={photoType} />
      </div>

      <div className="mt-4 space-y-3">
        {isError ? (
          <ErrorMessage onRetry={() => refetch()} />
        ) : isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="mx-5 h-[120px] rounded-2xl" />
          ))
        ) : (
          ROOM_META.map((room) => {
            const roomPhotos = photosByRoom.get(room.type) ?? []
            return (
              <RoomSection
                key={room.type}
                room={room}
                photos={roomPhotos}
                urlMap={urlMap}
                onOpen={() => navigate(`/photos/${room.type}?type=${photoType}`)}
                onAdd={() => handleAddTrigger(room.type)}
              />
            )
          })
        )}
      </div>

      {photos.length > 0 && (
        <button
          type="button"
          onClick={() => navigate(`/photos/report?type=${photoType}`)}
          className="mx-5 mt-4 flex w-[calc(100%-40px)] items-center justify-between rounded-2xl bg-white px-5 py-4"
        >
          <span className="text-[15px] font-semibold tracking-tight text-secondary">
            리포트 보기
          </span>
          <ChevronRight size={18} className="text-muted" />
        </button>
      )}

      <DevTabBar />
    </main>
  )
}
