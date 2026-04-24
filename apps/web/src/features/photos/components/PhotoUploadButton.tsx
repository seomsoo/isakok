import { useRef } from 'react'
import { Camera, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface PhotoUploadButtonProps {
  onCapture: (file: File) => void
  onGallerySelect: (files: File[]) => void
  disabled?: boolean
}

export function PhotoUploadButton({
  onCapture,
  onGallerySelect,
  disabled,
}: PhotoUploadButtonProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  return (
    <div className="sticky bottom-0 left-0 right-0 flex gap-3 border-t border-border bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="카메라로 촬영"
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
        aria-label="갤러리에서 선택"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) onGallerySelect(files)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
        className={cn(
          'flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary font-semibold text-white',
          'disabled:bg-primary/40',
        )}
      >
        <Camera size={18} />
        촬영
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => galleryRef.current?.click()}
        className={cn(
          'flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-white font-semibold text-secondary',
          'disabled:opacity-40',
        )}
      >
        <ImageIcon size={18} />
        갤러리
      </button>
    </div>
  )
}
