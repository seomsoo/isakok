import { MessageSquare, Loader2 } from 'lucide-react'
import type { PropertyPhoto } from '@/services/photos'
import { cn } from '@/lib/cn'
import { photoDisplayDate, formatKoreanDate } from '../utils/photoDate'

interface PhotoCardProps {
  photo: PropertyPhoto
  signedUrl?: string
  onPress: () => void
}

export function PhotoCard({ photo, signedUrl, onPress }: PhotoCardProps) {
  const hasMemo = !!photo.memo && photo.memo.trim().length > 0
  const formatted = formatKoreanDate(photoDisplayDate(photo))
  const dateLabel = formatted ? `${formatted} 촬영` : ''

  return (
    <button
      type="button"
      aria-label={`사진, ${dateLabel}${hasMemo ? `, 메모: ${photo.memo}` : ''}`}
      onClick={onPress}
      className="relative aspect-square overflow-hidden rounded-lg bg-surface"
    >
      {signedUrl ? (
        <img src={signedUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 size={16} className="animate-spin text-muted" />
        </div>
      )}
      {hasMemo && (
        <span
          aria-hidden
          className={cn(
            'absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white',
          )}
        >
          <MessageSquare size={10} />
        </span>
      )}
    </button>
  )
}
