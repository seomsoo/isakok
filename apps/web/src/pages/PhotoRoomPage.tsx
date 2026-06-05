import { useEffect } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, History } from 'lucide-react'
import { ROUTES, isValidRoomType, getRoomMeta, sendToNative } from '@moving/shared'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { usePhotos } from '@/features/photos/hooks/usePhotos'
import { useSignedUrls } from '@/features/photos/hooks/useSignedUrls'
import { useMediaUploadListener } from '@/features/photos/hooks/useMediaUploadListener'
import { PhotoGrid } from '@/features/photos/components/PhotoGrid'
import { PhotoUploadFab } from '@/features/photos/components/PhotoUploadFab'
import { PhotoEmptyState } from '@/features/photos/components/PhotoEmptyState'
import { RoomTipCard } from '@/features/photos/components/RoomTipCard'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { useToast } from '@/shared/components/ToastProvider'
import { useUserId } from '@/auth/useSession'
import { useGoBack } from '@/shared/hooks/useGoBack'
import { captureEvent, ANALYTICS_EVENTS } from '@/observability/events'
import type { PhotoType } from '@/services/photos'

export function PhotoRoomPage() {
  const { room } = useParams<{ room: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const photoType = searchParams.get('type') === 'move_out' ? 'move_out' : 'move_in'
  const goBack = useGoBack(`/photos?type=${photoType}`)

  const { data: move, isPending } = useCurrentMove()

  if (!room || !isValidRoomType(room)) return <Navigate to={ROUTES.PHOTOS} replace />
  if (isPending) return <main className="min-h-dvh bg-neutral" />
  if (!move) return <Navigate to={ROUTES.LANDING} replace />

  const roomMeta = getRoomMeta(room)

  return (
    <Inner
      moveId={move.id}
      room={room}
      roomMeta={roomMeta}
      photoType={photoType}
      onBack={goBack}
      onTrash={() => navigate(`/photos/trash?type=${photoType}`, { replace: true })}
      toast={toast}
    />
  )
}

interface InnerProps {
  moveId: string
  room: string
  roomMeta: ReturnType<typeof getRoomMeta>
  photoType: PhotoType
  onBack: () => void
  onTrash: () => void
  toast: ReturnType<typeof useToast>
}

function Inner({ moveId, room, roomMeta, photoType, onBack, onTrash, toast }: InnerProps) {
  const { userId, isAnonymous } = useUserId()
  const {
    data: allPhotos = [],
    isLoading,
    isError,
    refetch,
  } = usePhotos(moveId, photoType, userId ?? '')
  const photos = allPhotos.filter((p) => p.room === room)
  const paths = photos.map((p) => p.storage_path)
  const { data: urlMap } = useSignedUrls(paths, userId ?? '')

  // 네이티브가 Storage 업로드를 마치면 MEDIA_UPLOADED 수신 → DB INSERT (ADR-079).
  // requestPicker가 in-flight 가드를 들고 OPEN_MEDIA_PICKER 전송 (왕복 중 중복 업로드로 maxCount 초과 방지).
  const { isUploading, requestPicker } = useMediaUploadListener()

  // 사진 게이트 노출(ADR-074): 익명 사용자가 방에 진입 = 저장하려면 로그인 필요한 지점 도달
  useEffect(() => {
    if (isAnonymous === true) {
      captureEvent(ANALYTICS_EVENTS.PHOTO_GATE_SHOWN, { source: 'photo_room' })
    }
  }, [isAnonymous])

  const showTip = photos.length < 3 && photos.length > 0
  const isEmpty = photos.length === 0 && !isLoading && !isError
  const isAtMax = photos.length >= roomMeta.maxCount

  // 사진 저장 게이트(ADR-074): 익명 → 로그인 시트 (컴포넌트 내부에서 isAnonymous로 분기)
  const requestLogin = () => {
    // analytics source = 게이트가 뜬 화면(전환율 join 키, shown과 동일값). 네이티브 payload의 source('photo_gate')와 별개.
    captureEvent(ANALYTICS_EVENTS.PHOTO_GATE_LOGIN_CLICKED, { source: 'photo_room' })
    sendToNative({ type: 'REQUEST_LOGIN', payload: { source: 'photo_gate' } })
  }

  // 회원: 네이티브 미디어 피커 요청 (ADR-079). 네이티브가 업로드 후 MEDIA_UPLOADED 회신
  function handlePick(kind: 'camera' | 'gallery') {
    if (isAtMax) {
      toast.error(`최대 ${roomMeta.maxCount}장까지 저장할 수 있어요`)
      return
    }
    requestPicker({
      kind,
      multi: kind === 'gallery',
      moveId,
      room,
      photoType,
      maxSelect: roomMeta.maxCount - photos.length,
    })
  }

  return (
    <main className="flex min-h-dvh flex-col bg-neutral">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pt-[env(safe-area-inset-top)] h-11">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로가기"
          className="flex h-11 w-11 items-center justify-center text-secondary"
        >
          <ChevronLeft size={22} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={() => onTrash()}
          aria-label="최근 삭제"
          className="flex h-11 w-11 items-center justify-center text-muted"
        >
          <History size={20} />
        </button>
      </div>

      <div className="px-5 pb-1 pt-1.5">
        <h1 className="text-[28px] font-bold tracking-tight text-secondary leading-tight">
          {roomMeta.label}
        </h1>
        {!isEmpty && !isError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[14px] tracking-tight text-muted/70">
            <span>
              {photos.length}장 / 최대 {roomMeta.maxCount}장
            </span>
            {isAtMax && <span className="font-medium text-warning">· 가득 참</span>}
          </p>
        )}
      </div>

      <div className="flex-1">
        {showTip && !isError && (
          <div className="mt-2">
            <RoomTipCard tip={roomMeta.tip} />
          </div>
        )}
        {isError ? (
          <ErrorMessage onRetry={() => refetch()} />
        ) : isEmpty ? (
          <PhotoEmptyState
            tipDetail={roomMeta.tipDetail}
            onPick={handlePick}
            isAnonymous={isAnonymous === true}
            onRequestLogin={requestLogin}
          />
        ) : (
          <div className="mt-4">
            <PhotoGrid
              photos={photos}
              urlMap={urlMap}
              moveId={moveId}
              photoType={photoType}
              room={room}
            />
          </div>
        )}
      </div>
      {!isEmpty && !isError && (
        <PhotoUploadFab
          disabled={isAtMax || isUploading}
          onPick={handlePick}
          isAnonymous={isAnonymous === true}
          onRequestLogin={requestLogin}
        />
      )}
    </main>
  )
}
