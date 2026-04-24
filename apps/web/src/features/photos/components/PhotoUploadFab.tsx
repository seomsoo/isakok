import { useRef, useState } from 'react'
import { Camera, Image as ImageIcon, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface PhotoUploadFabProps {
  onCapture: (file: File) => void
  onGallerySelect: (files: File[]) => void
  disabled?: boolean
}

export function PhotoUploadFab({
  onCapture,
  onGallerySelect,
  disabled,
}: PhotoUploadFabProps) {
  const [isOpen, setIsOpen] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  return (
    <>
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
          setIsOpen(false)
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
          setIsOpen(false)
        }}
      />

      {isOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
      )}

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+20px)] right-5 z-40 flex flex-col items-end gap-3">
        {isOpen && (
          <>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex h-12 items-center gap-2 rounded-2xl bg-white px-4 shadow-lg"
            >
              <ImageIcon size={18} className="text-secondary" />
              <span className="text-[14px] font-medium text-secondary">갤러리</span>
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex h-12 items-center gap-2 rounded-2xl bg-white px-4 shadow-lg"
            >
              <Camera size={18} className="text-secondary" />
              <span className="text-[14px] font-medium text-secondary">촬영</span>
            </button>
          </>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? '닫기' : '사진 추가'}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform duration-200',
            isOpen
              ? 'rotate-45 bg-secondary text-white'
              : 'bg-primary text-white',
            'disabled:opacity-40',
          )}
        >
          {isOpen ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>
    </>
  )
}
