import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Trash2 } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import type { PropertyPhoto, PhotoType } from '@/services/photos'
import { useUpdatePhotoMemo } from '../hooks/useUpdatePhotoMemo'
import { useDeletePhoto, MAX_DELETED_PER_ROOM } from '../hooks/useDeletePhoto'
import { useDeletedPhotos } from '../hooks/useDeletedPhotos'
import { DeletePhotoDialog } from './DeletePhotoDialog'
import { cn } from '@/lib/cn'

interface PhotoDetailSheetProps {
  photo: PropertyPhoto
  signedUrl?: string
  moveId: string
  photoType: PhotoType
  isOpen: boolean
  onClose: () => void
}

type SaveStatus = 'idle' | 'saving' | 'saved'

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`
}

export function PhotoDetailSheet({
  photo,
  signedUrl,
  moveId,
  photoType,
  isOpen,
  onClose,
}: PhotoDetailSheetProps) {
  const [memo, setMemo] = useState(photo.memo ?? '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const updateMemo = useUpdatePhotoMemo(moveId, photoType)
  const deletePhoto = useDeletePhoto(moveId, photoType, photo.room)
  const { data: deletedPhotos = [] } = useDeletedPhotos(moveId, photoType, photo.room)
  const isOverflow = deletedPhotos.length >= MAX_DELETED_PER_ROOM

  const lastSavedRef = useRef(photo.memo ?? '')
  const inFlightRef = useRef(false)
  const pendingRef = useRef<string | null>(null)
  const savedTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setMemo(photo.memo ?? '')
    lastSavedRef.current = photo.memo ?? ''
  }, [photo.id, photo.memo])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(
    () => () => {
      if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current)
    },
    [],
  )

  const save = (value: string) => {
    if (value === lastSavedRef.current) return
    if (inFlightRef.current) {
      pendingRef.current = value
      return
    }
    inFlightRef.current = true
    setSaveStatus('saving')
    updateMemo.mutate(
      { photoId: photo.id, memo: value },
      {
        onSuccess: () => {
          lastSavedRef.current = value
          inFlightRef.current = false
          const next = pendingRef.current
          if (next !== null && next !== value) {
            pendingRef.current = null
            save(next)
            return
          }
          pendingRef.current = null
          setSaveStatus('saved')
          if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current)
          savedTimerRef.current = window.setTimeout(() => setSaveStatus('idle'), 2000)
        },
        onError: () => {
          inFlightRef.current = false
          pendingRef.current = null
          setSaveStatus('idle')
        },
      },
    )
  }

  const debouncedSave = useDebouncedCallback(save, 1000)

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setMemo(value)
    debouncedSave(value)
  }

  function handleDelete() {
    deletePhoto.mutate(photo.id, { onSuccess: onClose })
  }

  if (!isOpen) return null

  const dateIso = photo.taken_at ?? photo.uploaded_at ?? photo.created_at

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="사진 상세"
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[430px] rounded-t-2xl bg-white pb-[calc(env(safe-area-inset-bottom)+16px)]"
        >
          <div className="flex justify-end p-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface"
            >
              <X size={20} />
            </button>
          </div>
          <div className="px-5">
            <div className="flex max-h-[50vh] items-center justify-center overflow-hidden rounded-xl bg-black">
              {signedUrl ? (
                <img
                  src={signedUrl}
                  alt=""
                  className="max-h-[50vh] w-full object-contain"
                />
              ) : (
                <Loader2 className="animate-spin text-white" />
              )}
            </div>
            <p className="mt-3 text-body-sm text-tertiary">{formatDateTime(dateIso)}</p>
            <div className="mt-3">
              <textarea
                value={memo}
                onChange={handleChange}
                onBlur={() => debouncedSave.flush()}
                placeholder="메모 입력..."
                aria-label="사진 메모"
                rows={3}
                className={cn(
                  'w-full resize-none rounded-xl bg-surface p-3 text-body-sm text-secondary',
                  'placeholder:text-placeholder focus:outline-none',
                )}
              />
              <span
                role="status"
                aria-live="polite"
                className="mt-1 flex h-4 items-center text-caption text-muted"
              >
                {saveStatus === 'saving' && (
                  <Loader2 size={12} className="animate-spin" strokeWidth={2.5} />
                )}
                {saveStatus === 'saved' && <span className="text-success">저장됨</span>}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="mt-4 flex items-center gap-1.5 text-body-sm font-medium text-critical"
            >
              <Trash2 size={16} />
              사진 삭제
            </button>
          </div>
        </div>
      </div>
      <DeletePhotoDialog
        isOpen={deleteOpen}
        overflow={isOverflow}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  )
}
