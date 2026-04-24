import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, History } from 'lucide-react'
import { ROUTES, isValidRoomType, getRoomMeta } from '@moving/shared'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { usePhotos } from '@/features/photos/hooks/usePhotos'
import { useSignedUrls } from '@/features/photos/hooks/useSignedUrls'
import { useUploadPhoto } from '@/features/photos/hooks/useUploadPhoto'
import { photoKeys } from '@/features/photos/hooks/queryKeys'
import { PhotoGrid } from '@/features/photos/components/PhotoGrid'
import { PhotoUploadFab } from '@/features/photos/components/PhotoUploadFab'
import { PhotoEmptyState } from '@/features/photos/components/PhotoEmptyState'
import { RoomTipCard } from '@/features/photos/components/RoomTipCard'
import { useToast } from '@/shared/components/ToastProvider'
import type { PhotoType } from '@/services/photos'

const MAX_BYTES = 10 * 1024 * 1024
const TEMP_USER_ID = '00000000-0000-0000-0000-000000000000'

export function PhotoRoomPage() {
  const { room } = useParams<{ room: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [uploadingCount, setUploadingCount] = useState(0)

  const { data: move, isPending } = useCurrentMove()

  if (!room || !isValidRoomType(room)) return <Navigate to={ROUTES.PHOTOS} replace />
  if (isPending) return <main className="min-h-dvh bg-neutral" />
  if (!move) return <Navigate to={ROUTES.LANDING} replace />

  const roomMeta = getRoomMeta(room)
  const queryType = searchParams.get('type') as PhotoType | null
  const photoType: PhotoType = queryType === 'move_out' ? 'move_out' : 'move_in'

  return (
    <Inner
      moveId={move.id}
      room={room}
      roomMeta={roomMeta}
      photoType={photoType}
      uploadingCount={uploadingCount}
      setUploadingCount={setUploadingCount}
      onBack={() => navigate(`/photos?type=${photoType}`)}
      onTrash={() => navigate(`/photos/trash?type=${photoType}`)}
      toast={toast}
    />
  )
}

interface InnerProps {
  moveId: string
  room: string
  roomMeta: ReturnType<typeof getRoomMeta>
  photoType: PhotoType
  uploadingCount: number
  setUploadingCount: (n: number) => void
  onBack: () => void
  onTrash: () => void
  toast: ReturnType<typeof useToast>
}

function Inner({
  moveId,
  room,
  roomMeta,
  photoType,
  uploadingCount,
  setUploadingCount,
  onBack,
  onTrash,
  toast,
}: InnerProps) {
  const queryClient = useQueryClient()
  const { data: allPhotos = [], isLoading } = usePhotos(moveId, photoType)
  const photos = allPhotos.filter((p) => p.room === room)
  const paths = photos.map((p) => p.storage_path)
  const { data: urlMap } = useSignedUrls(paths)
  const uploadMutation = useUploadPhoto()

  const showTip = photos.length < 3 && photos.length > 0
  const isEmpty = photos.length === 0 && !isLoading
  const isAtMax = photos.length >= roomMeta.maxCount

  async function handleUpload(files: File[]) {
    if (uploadingCount > 0) return
    if (isAtMax) {
      toast.error(`최대 ${roomMeta.maxCount}장까지 저장할 수 있어요`)
      return
    }
    const remaining = roomMeta.maxCount - photos.length
    const valid = files.slice(0, remaining).filter((f) => {
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}은(는) 10MB를 초과해서 건너뛰었어요`)
        return false
      }
      return true
    })
    if (valid.length === 0) return

    setUploadingCount(valid.length)

    const results = await Promise.allSettled(
      valid.map((file) =>
        uploadMutation.mutateAsync({
          moveId,
          userId: TEMP_USER_ID,
          file,
          room,
          photoType,
        }),
      ),
    )
    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - succeeded
    setUploadingCount(0)
    queryClient.invalidateQueries({ queryKey: photoKeys.byMove(moveId, photoType) })
    if (failed > 0) toast.error(`${failed}장 저장에 실패했어요`)
    if (succeeded > 0) toast.success(`${succeeded}장 저장 완료`)
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
        {!isEmpty && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[14px] tracking-tight text-muted/70">
            <span>{photos.length}장 / 최대 {roomMeta.maxCount}장</span>
            {isAtMax && (
              <span className="font-medium text-warning">· 가득 참</span>
            )}
          </p>
        )}
      </div>

      <div className="flex-1">
        {showTip && (
          <div className="mt-2">
            <RoomTipCard tip={roomMeta.tip} />
          </div>
        )}
        {isEmpty ? (
          <PhotoEmptyState
            tipDetail={roomMeta.tipDetail}
            onCapture={(file) => handleUpload([file])}
            onGallerySelect={(files) => handleUpload(files)}
          />
        ) : (
          <div className="mt-4">
            <PhotoGrid
              photos={photos}
              urlMap={urlMap}
              uploadingCount={uploadingCount}
              moveId={moveId}
              photoType={photoType}
              room={room}
            />
          </div>
        )}
      </div>
      {!isEmpty && (
        <PhotoUploadFab
          disabled={uploadingCount > 0 || isAtMax}
          onCapture={(file) => handleUpload([file])}
          onGallerySelect={(files) => handleUpload(files)}
        />
      )}
    </main>
  )
}
