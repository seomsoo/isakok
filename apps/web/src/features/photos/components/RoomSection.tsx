import { Plus, Check, Loader2 } from 'lucide-react'
import type { RoomMeta } from '@moving/shared'
import type { PropertyPhoto } from '@/services/photos'
import { cn } from '@/lib/cn'

interface RoomSectionProps {
  room: RoomMeta
  photos: PropertyPhoto[]
  urlMap?: Record<string, string>
  onOpen: () => void
  onAdd: () => void
}

export function RoomSection({ room, photos, urlMap, onOpen, onAdd }: RoomSectionProps) {
  const count = photos.length
  const target = room.recommendedCount
  const reached = count >= target
  const isFull = count >= room.maxCount
  const isEmpty = count === 0

  return (
    <div className="mx-5 rounded-3xl bg-white px-5 py-6">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between text-left"
        aria-label={`${room.label} 상세 보기`}
      >
        <span className="text-[16px] font-bold text-secondary">{room.label}</span>
        <div className="flex items-center gap-1.5">
          {reached && (
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary">
              <Check size={11} strokeWidth={3} className="text-white" />
            </span>
          )}
          <span
            className={cn(
              'text-[14px] font-medium tabular-nums',
              reached ? 'text-primary' : 'text-muted',
            )}
          >
            {count}/{room.maxCount}
          </span>
        </div>
      </button>

      <div className="-mx-5 mt-4 flex gap-3 overflow-x-auto px-5 scrollbar-hide">
        {photos.map((p) => {
          const url = urlMap?.[p.storage_path]
          return (
            <button
              key={p.id}
              type="button"
              onClick={onOpen}
              className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-neutral"
              aria-label={`${room.label} 사진 보기`}
            >
              {url ? (
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Loader2 size={14} className="animate-spin text-muted" />
                </div>
              )}
            </button>
          )
        })}
        {!isFull && (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-border"
            aria-label={`${room.label} 사진 추가`}
          >
            <Plus size={20} strokeWidth={1.5} className="text-placeholder" />
            {isEmpty && (
              <span className="text-[11px] text-placeholder">추가</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
