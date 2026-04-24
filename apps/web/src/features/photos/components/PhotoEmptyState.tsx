import { useRef } from 'react'
import { Camera, Image as ImageIcon } from 'lucide-react'

interface PhotoEmptyStateProps {
  tipDetail: string
  onCapture: (file: File) => void
  onGallerySelect: (files: File[]) => void
}

export function PhotoEmptyState({ tipDetail, onCapture, onGallerySelect }: PhotoEmptyStateProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onCapture(f)
          e.target.value = ''
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) onGallerySelect(files)
          e.target.value = ''
        }}
      />

      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
        <Camera size={24} strokeWidth={1.5} className="text-muted" />
      </div>
      <p className="text-[15px] font-semibold text-secondary">아직 사진이 없어요</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{tipDetail}</p>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex h-12 items-center gap-1.5 rounded-xl bg-primary px-5 font-semibold text-white"
        >
          <Camera size={18} />
          촬영
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex h-12 items-center gap-1.5 rounded-xl border border-border bg-white px-5 font-semibold text-secondary"
        >
          <ImageIcon size={18} />
          갤러리
        </button>
      </div>
    </div>
  )
}
