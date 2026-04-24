import { useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { ROOM_META, ROUTES } from '@moving/shared'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { usePhotos } from '@/features/photos/hooks/usePhotos'
import { useSignedUrls } from '@/features/photos/hooks/useSignedUrls'
import { useUploadPhoto } from '@/features/photos/hooks/useUploadPhoto'
import { photoKeys } from '@/features/photos/hooks/queryKeys'
import { PhotoTopTabs } from '@/features/photos/components/PhotoTopTabs'
import { PhotoInfoBanner } from '@/features/photos/components/PhotoInfoBanner'
import { RoomSection } from '@/features/photos/components/RoomSection'
import { DevTabBar } from '@/shared/components/DevTabBar'
import { Skeleton } from '@/shared/components/Skeleton'
import { useToast } from '@/shared/components/ToastProvider'
import type { PhotoType } from '@/services/photos'

const MAX_BYTES = 10 * 1024 * 1024
const TEMP_USER_ID = '00000000-0000-0000-0000-000000000000'

export function PhotosPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const galleryRef = useRef<HTMLInputElement>(null)
  const [activeRoom, setActiveRoom] = useState<string | null>(null)

  const { data: move, isPending } = useCurrentMove()

  const daysUntilMove = move
    ? differenceInCalendarDays(parseISO(move.moving_date), new Date())
    : 0
  const queryType = searchParams.get('type') as PhotoType | null
  const photoType: PhotoType =
    queryType === 'move_in' || queryType === 'move_out'
      ? queryType
      : daysUntilMove > 0
        ? 'move_out'
        : 'move_in'

  const queryClient = useQueryClient()
  const { data: photos = [], isLoading } = usePhotos(move?.id, photoType)
  const uploadMutation = useUploadPhoto()

  const photosByRoom = new Map<string, typeof photos>()
  for (const p of photos) {
    const list = photosByRoom.get(p.room) ?? []
    list.push(p)
    photosByRoom.set(p.room, list)
  }
  const previewPaths = ROOM_META.flatMap((r) =>
    (photosByRoom.get(r.type) ?? []).map((p) => p.storage_path),
  )
  const { data: urlMap } = useSignedUrls(previewPaths)

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
    setActiveRoom(room)
    galleryRef.current?.click()
  }

  async function handleGallerySelect(files: File[]) {
    if (!activeRoom || !move) return
    const roomMeta = ROOM_META.find((r) => r.type === activeRoom)
    const currentCount = (photosByRoom.get(activeRoom) ?? []).length
    const remaining = (roomMeta?.maxCount ?? 6) - currentCount
    if (remaining <= 0) {
      toast.error(`최대 ${roomMeta?.maxCount ?? 6}장까지 저장할 수 있어요`)
      return
    }
    const valid = files.slice(0, remaining).filter((f) => {
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}은(는) 10MB를 초과해서 건너뛰었어요`)
        return false
      }
      return true
    })
    if (valid.length === 0) return

    const results = await Promise.allSettled(
      valid.map((file) =>
        uploadMutation.mutateAsync({
          moveId: move.id,
          userId: TEMP_USER_ID,
          file,
          room: activeRoom,
          photoType,
        }),
      ),
    )
    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - succeeded
    queryClient.invalidateQueries({ queryKey: photoKeys.byMove(move.id, photoType) })
    if (failed > 0) toast.error(`${failed}장 저장에 실패했어요`)
    if (succeeded > 0) toast.success(`${succeeded}장 저장 완료`)
    setActiveRoom(null)
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
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="mx-5 h-[120px] rounded-2xl" />
            ))
          : ROOM_META.map((room) => {
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
            })}
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

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="갤러리에서 선택"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) handleGallerySelect(files)
          e.target.value = ''
        }}
      />

      <DevTabBar />
    </main>
  )
}
