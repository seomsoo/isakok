import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Loader2, Trash2 } from 'lucide-react'
import { differenceInMinutes } from 'date-fns'
import { ROUTES, ROOM_META, getRoomMeta, type RoomType } from '@moving/shared'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  getAllDeletedPhotos,
  restorePhoto,
  hardDeletePhoto,
  type PhotoType,
  type PropertyPhoto,
} from '@/services/photos'
import { useSignedUrls } from '@/features/photos/hooks/useSignedUrls'
import { usePhotos } from '@/features/photos/hooks/usePhotos'
import { photoKeys } from '@/features/photos/hooks/queryKeys'
import { useToast } from '@/shared/components/ToastProvider'
import { cn } from '@/lib/cn'

const FILTER_ALL = 'all'

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const mins = differenceInMinutes(new Date(), new Date(iso))
  if (mins < 60) return `${Math.max(1, mins)}분 전 삭제됨`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}시간 전 삭제됨`
  const d = Math.floor(mins / (60 * 24))
  if (d < 7) return `${d}일 전 삭제됨`
  if (d < 30) return `${Math.floor(d / 7)}주 전 삭제됨`
  return `${Math.floor(d / 30)}개월 전 삭제됨`
}

function daysLeft(iso: string | null): number {
  if (!iso) return 30
  const mins = differenceInMinutes(new Date(), new Date(iso))
  return Math.max(0, 30 - Math.floor(mins / (60 * 24)))
}

export function PhotoTrashPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: move, isPending } = useCurrentMove()

  if (isPending) return <main className="min-h-dvh bg-neutral" />
  if (!move) return <Navigate to={ROUTES.LANDING} replace />

  const queryType = searchParams.get('type') as PhotoType | null
  const photoType: PhotoType = queryType === 'move_out' ? 'move_out' : 'move_in'

  return <Inner moveId={move.id} photoType={photoType} onBack={() => navigate(-1)} />
}

interface InnerProps {
  moveId: string
  photoType: PhotoType
  onBack: () => void
}

function Inner({ moveId, photoType, onBack }: InnerProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [activeFilter, setActiveFilter] = useState<string>(FILTER_ALL)

  const { data: activePhotos = [] } = usePhotos(moveId, photoType)
  const { data: deletedPhotos = [], isLoading } = useQuery({
    queryKey: photoKeys.allDeleted(moveId, photoType),
    queryFn: () => getAllDeletedPhotos(moveId, photoType),
  })

  const activeCountByRoom = new Map<string, number>()
  for (const p of activePhotos) {
    activeCountByRoom.set(p.room, (activeCountByRoom.get(p.room) ?? 0) + 1)
  }

  const paths = deletedPhotos.map((p) => p.storage_path)
  const { data: urlMap } = useSignedUrls(paths)

  const restoreMutation = useMutation({
    mutationFn: restorePhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: photoKeys.allDeleted(moveId, photoType) })
      queryClient.invalidateQueries({ queryKey: photoKeys.byMove(moveId, photoType) })
      toast.success('사진을 복구했어요')
    },
    onError: () => toast.error('복구에 실패했어요'),
  })

  const hardDeleteMutation = useMutation({
    mutationFn: (photo: PropertyPhoto) => hardDeletePhoto(photo.id, photo.storage_path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: photoKeys.allDeleted(moveId, photoType) })
      toast.success('영구삭제했어요')
    },
    onError: () => toast.error('삭제에 실패했어요'),
  })

  const roomsWithPhotos = ROOM_META.filter((r) => deletedPhotos.some((p) => p.room === r.type))

  const counts = new Map<string, number>()
  counts.set(FILTER_ALL, deletedPhotos.length)
  for (const r of ROOM_META) {
    const c = deletedPhotos.filter((p) => p.room === r.type).length
    if (c > 0) counts.set(r.type, c)
  }

  if (activeFilter !== FILTER_ALL && !counts.has(activeFilter)) {
    setActiveFilter(FILTER_ALL)
  }

  const filteredPhotos =
    activeFilter === FILTER_ALL
      ? deletedPhotos
      : deletedPhotos.filter((p) => p.room === activeFilter)

  return (
    <main className="flex min-h-dvh flex-col bg-[#FAFAFA]">
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
      </div>

      <div className="px-5 pb-1 pt-1.5">
        <h1 className="text-[28px] font-bold tracking-tight text-secondary leading-tight">
          최근 삭제
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted/70 tracking-tight">
          방마다 최대 3장까지 저장돼요
          <br />
          사진은 30일 뒤 자동으로 정리돼요
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={24} className="animate-spin text-muted" />
        </div>
      ) : deletedPhotos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-black/[0.04]">
            <Trash2 size={22} className="text-muted/60" />
          </div>
          <p className="text-center text-[14px] text-muted/60 tracking-tight">
            삭제된 사진이 없어요
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+24px)]">
          {/* Filter chips */}
          {roomsWithPhotos.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto px-4 pt-2.5 pb-3 scrollbar-hide">
              <FilterChip
                label="전체"
                count={counts.get(FILTER_ALL) ?? 0}
                isActive={activeFilter === FILTER_ALL}
                onClick={() => setActiveFilter(FILTER_ALL)}
              />
              {roomsWithPhotos.map((room) => (
                <FilterChip
                  key={room.type}
                  label={room.label}
                  count={counts.get(room.type) ?? 0}
                  isActive={activeFilter === room.type}
                  onClick={() => setActiveFilter(room.type)}
                />
              ))}
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filteredPhotos.map((photo) => {
              const roomCount = activeCountByRoom.get(photo.room) ?? 0
              const roomMax = getRoomMeta(photo.room as RoomType).maxCount
              const isRoomFull = roomCount >= roomMax
              return (
                <TrashRow
                  key={photo.id}
                  photo={photo}
                  url={urlMap?.[photo.storage_path]}
                  isRoomFull={isRoomFull}
                  onRestore={() => {
                    if (isRoomFull) {
                      toast.error('방 사진이 가득 찼어요. 기존 사진을 삭제한 후 복구해주세요')
                      return
                    }
                    restoreMutation.mutate(photo.id)
                  }}
                  onHardDelete={() => hardDeleteMutation.mutate(photo)}
                />
              )
            })}

            <div className="h-6" />
          </div>
        </div>
      )}
    </main>
  )
}

function FilterChip({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string
  count: number
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-[5px] rounded-full px-[13px] py-[7px] text-[14px] tracking-tight transition-colors',
        isActive
          ? 'bg-primary font-semibold text-white'
          : 'bg-black/[0.05] font-medium text-muted/80',
      )}
    >
      <span>{label}</span>
      <span
        className={cn('tabular-nums', isActive ? 'font-medium text-white/60' : 'text-muted/45')}
      >
        {count}
      </span>
    </button>
  )
}

function TrashRow({
  photo,
  url,
  isRoomFull,
  onRestore,
  onHardDelete,
}: {
  photo: PropertyPhoto
  url?: string
  isRoomFull: boolean
  onRestore: () => void
  onHardDelete: () => void
}) {
  const desc = photo.memo?.trim()
    ? `${getRoomMeta(photo.room as RoomType).label} · ${photo.memo.trim()}`
    : getRoomMeta(photo.room as RoomType).label
  const ago = timeAgo(photo.deleted_at)
  const days = daysLeft(photo.deleted_at)
  const isUrgent = days <= 3

  return (
    <div className="relative flex items-center gap-3 bg-white px-4 py-3.5 active:bg-[#F7F7F8] transition-colors">
      {/* Thumbnail */}
      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[14px] bg-neutral">
        {url ? (
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 size={14} className="animate-spin text-muted/50" />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[15.5px] font-semibold leading-snug tracking-tight text-secondary">
          {desc}
        </p>
        <p className="flex items-center gap-1.5 text-[13px] tracking-tight text-muted/65">
          <span>{ago}</span>
          <span className="text-muted/30">·</span>
          <span className={cn(isUrgent && 'font-semibold text-primary')}>{days}일 뒤 정리</span>
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={onRestore}
          disabled={isRoomFull}
          className={cn(
            'rounded-full px-3 py-2 text-[14px] font-semibold tracking-tight',
            isRoomFull ? 'text-placeholder' : 'text-primary',
          )}
        >
          복구
        </button>
        <button
          type="button"
          onClick={onHardDelete}
          className="rounded-full px-2.5 py-2 text-[14px] tracking-tight text-muted/55"
        >
          삭제
        </button>
      </div>

      {/* Separator — starts after thumbnail */}
      <div className="absolute bottom-0 left-[100px] right-4 h-px bg-black/[0.06]" />
    </div>
  )
}
