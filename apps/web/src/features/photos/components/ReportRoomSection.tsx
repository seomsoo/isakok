import type { RoomMeta } from '@moving/shared'
import type { PropertyPhoto } from '@/services/photos'

interface ReportRoomSectionProps {
  room: RoomMeta
  photos: PropertyPhoto[]
  urlMap?: Record<string, string>
  onPhotoPress: (photo: PropertyPhoto) => void
}

export function ReportRoomSection({
  room,
  photos,
  urlMap,
  onPhotoPress,
}: ReportRoomSectionProps) {
  if (photos.length === 0) return null
  const memoPhotos = photos.filter((p) => p.memo && p.memo.trim().length > 0)

  return (
    <section className="mx-4 rounded-[20px] bg-white px-5 pb-[22px] pt-5">
      {/* Header: room label + count */}
      <div className="mb-3.5 flex items-baseline justify-between">
        <h3 className="text-[17px] font-bold tracking-tight text-secondary">{room.label}</h3>
        <span className="text-[13px] tabular-nums tracking-tight text-muted">
          <span className="font-semibold text-secondary">{photos.length}</span>장
        </span>
      </div>

      {/* 3-col photo grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {photos.map((p, i) => {
          const url = urlMap?.[p.storage_path]
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPhotoPress(p)}
              className="relative aspect-square overflow-hidden rounded-xl bg-neutral"
            >
              {url && (
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
              <span className="absolute left-2 top-1.5 text-[15px] font-extrabold tabular-nums text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                {i + 1}
              </span>
            </button>
          )
        })}
      </div>

      {/* Memo */}
      {memoPhotos.length > 0 && (
        <div className="mt-3.5">
          <p className="mb-1.5 text-[12px] font-semibold tracking-tight text-muted">메모</p>
          <div className="space-y-1.5">
            {memoPhotos.map((p) => {
              const idx = photos.indexOf(p) + 1
              return (
                <p key={p.id} className="line-clamp-2 text-[13.5px] leading-relaxed tracking-tight text-secondary">
                  <span className="tabular-nums text-muted">{idx}.</span> {p.memo}
                </p>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
