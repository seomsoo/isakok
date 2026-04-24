import { useRef, useState } from 'react'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import type { PropertyPhoto, PhotoType } from '@/services/photos'
import { useUpdatePhotoMemo } from '../hooks/useUpdatePhotoMemo'
import { useDeletePhoto, MAX_DELETED_PER_ROOM } from '../hooks/useDeletePhoto'
import { useDeletedPhotos } from '../hooks/useDeletedPhotos'
import { DeletePhotoDialog } from './DeletePhotoDialog'
import { PhotoFullscreenViewer } from './PhotoFullscreenViewer'

const MEMO_MAX_LENGTH = 200

interface PhotoGridProps {
  photos: PropertyPhoto[]
  urlMap?: Record<string, string>
  uploadingCount?: number
  moveId: string
  photoType: PhotoType
  room: string
}

function formatStampTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const h = d.getHours()
  const period = h < 12 ? '오전' : '오후'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${h12}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatStampDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function PhotoGrid({
  photos,
  urlMap,
  uploadingCount = 0,
  moveId,
  photoType,
  room,
}: PhotoGridProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PropertyPhoto | null>(null)
  const [fullscreenPhoto, setFullscreenPhoto] = useState<PropertyPhoto | null>(null)

  const { data: deletedPhotos = [] } = useDeletedPhotos(moveId, photoType, room)
  const isTrashFull = deletedPhotos.length >= MAX_DELETED_PER_ROOM

  return (
    <div
      className="space-y-5 px-5 pb-24"
      aria-busy={uploadingCount > 0 ? 'true' : undefined}
    >
      {photos.map((p) => (
        <PhotoCard
          key={p.id}
          photo={p}
          url={urlMap?.[p.storage_path]}
          moveId={moveId}
          photoType={photoType}
          room={room}
          isMenuOpen={menuOpenId === p.id}
          onMenuToggle={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}
          onMenuClose={() => setMenuOpenId(null)}
          onDelete={() => {
            setMenuOpenId(null)
            setDeleteTarget(p)
          }}
          onPhotoTap={() => setFullscreenPhoto(p)}
        />
      ))}

      {Array.from({ length: uploadingCount }).map((_, i) => (
        <div
          key={`uploading-${i}`}
          className="flex aspect-4/3 w-full items-center justify-center rounded-2xl bg-surface"
          aria-label="사진 업로드 중"
        >
          <Loader2 size={24} className="animate-spin text-muted" />
        </div>
      ))}

      {deleteTarget && (
        <DeleteCardWrapper
          photo={deleteTarget}
          moveId={moveId}
          photoType={photoType}
          room={room}
          isOverflow={isTrashFull}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {fullscreenPhoto && (
        <PhotoFullscreenViewer
          photo={fullscreenPhoto}
          signedUrl={urlMap?.[fullscreenPhoto.storage_path]}
          onClose={() => setFullscreenPhoto(null)}
        />
      )}
    </div>
  )
}

interface PhotoCardProps {
  photo: PropertyPhoto
  url?: string
  moveId: string
  photoType: PhotoType
  room: string
  isMenuOpen: boolean
  onMenuToggle: () => void
  onMenuClose: () => void
  onDelete: () => void
  onPhotoTap: () => void
}

function PhotoCard({
  photo,
  url,
  moveId,
  photoType,
  isMenuOpen,
  onMenuToggle,
  onMenuClose,
  onDelete,
  onPhotoTap,
}: PhotoCardProps) {
  const dateIso = photo.taken_at ?? photo.uploaded_at ?? photo.created_at
  const stampDate = formatStampDate(dateIso)
  const stampTime = formatStampTime(dateIso)
  const [memo, setMemo] = useState(photo.memo ?? '')
  const [isEditingMemo, setIsEditingMemo] = useState(false)
  const updateMemo = useUpdatePhotoMemo(moveId, photoType)
  const lastSavedRef = useRef(photo.memo ?? '')

  const saveMemo = (value: string) => {
    if (value === lastSavedRef.current) return
    lastSavedRef.current = value
    updateMemo.mutate({ photoId: photo.id, memo: value })
  }

  const debouncedSave = useDebouncedCallback(saveMemo, 1000)

  function handleMemoChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value.slice(0, MEMO_MAX_LENGTH)
    setMemo(value)
    debouncedSave(value)
  }

  function handleMemoBlur() {
    debouncedSave.flush()
    setIsEditingMemo(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onPhotoTap}
        className="relative w-full overflow-hidden rounded-2xl bg-neutral"
        aria-label="사진 확대 보기"
      >
        {url ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            className="aspect-4/3 w-full object-cover transition-transform duration-200 active:scale-[0.98]"
          />
        ) : (
          <div className="flex aspect-4/3 w-full items-center justify-center">
            <Loader2 size={20} className="animate-spin text-muted" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 rounded-b-2xl bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        {stampTime && (
          <div className="absolute bottom-3.5 left-4">
            <span className="block text-[14px] font-semibold leading-none text-white/80 drop-shadow-lg">
              {stampDate}
            </span>
            <span className="mt-1.5 block text-[26px] font-extrabold leading-none tabular-nums tracking-tight text-white drop-shadow-lg">
              {stampTime}
            </span>
          </div>
        )}
      </button>

      <div className="absolute right-2 top-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onMenuToggle()
          }}
          aria-label="더보기"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
        >
          <MoreHorizontal size={18} />
        </button>
        {isMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={onMenuClose} />
            <div className="absolute right-0 top-10 z-20 min-w-[120px] overflow-hidden rounded-xl bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onMenuClose()
                  setIsEditingMemo(true)
                }}
                className="flex w-full items-center border-b border-border px-4 py-3 text-[14px] font-medium text-secondary"
              >
                메모 편집
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex w-full items-center px-4 py-3 text-[14px] font-medium text-critical"
              >
                삭제
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-2 px-1">
        {isEditingMemo ? (
          <div className="relative">
            <textarea
              value={memo}
              onChange={handleMemoChange}
              onBlur={handleMemoBlur}
              autoFocus
              rows={2}
              maxLength={MEMO_MAX_LENGTH}
              placeholder="메모 입력..."
              aria-label="사진 메모"
              className="w-full resize-none rounded-xl bg-surface p-3 text-[13px] text-secondary placeholder:text-placeholder focus:outline-none"
            />
            <span className="absolute bottom-2 right-3 text-[11px] text-placeholder">
              {memo.length}/{MEMO_MAX_LENGTH}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingMemo(true)}
            className="w-full text-left"
          >
            {memo.trim() ? (
              <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">
                {memo}
              </p>
            ) : (
              <p className="text-[13px] text-placeholder">메모 추가</p>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function DeleteCardWrapper({
  photo,
  moveId,
  photoType,
  room,
  isOverflow,
  onClose,
}: {
  photo: PropertyPhoto
  moveId: string
  photoType: PhotoType
  room: string
  isOverflow: boolean
  onClose: () => void
}) {
  const deletePhoto = useDeletePhoto(moveId, photoType, room)

  return (
    <DeletePhotoDialog
      isOpen
      overflow={isOverflow}
      onClose={onClose}
      onConfirm={() => deletePhoto.mutate(photo.id)}
    />
  )
}
