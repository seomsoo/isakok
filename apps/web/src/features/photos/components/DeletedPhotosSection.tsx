import { useState } from 'react'
import { ChevronDown, Trash2, Loader2, RotateCcw } from 'lucide-react'
import type { PhotoType } from '@/services/photos'
import { useDeletedPhotos } from '../hooks/useDeletedPhotos'
import { useRestorePhoto } from '../hooks/useRestorePhoto'
import { useSignedUrls } from '../hooks/useSignedUrls'
import { cn } from '@/lib/cn'

interface DeletedPhotosSectionProps {
  moveId: string
  photoType: PhotoType
  room: string
}

export function DeletedPhotosSection({ moveId, photoType, room }: DeletedPhotosSectionProps) {
  const { data: deletedPhotos = [] } = useDeletedPhotos(moveId, photoType, room)
  const restoreMutation = useRestorePhoto(moveId, photoType, room)
  const paths = deletedPhotos.map((p) => p.storage_path)
  const { data: urlMap } = useSignedUrls(paths)
  const [expanded, setExpanded] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (deletedPhotos.length === 0) return null

  return (
    <div className="mx-5 mt-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Trash2 size={14} className="text-muted" />
        <span className="text-[13px] font-medium text-muted">
          최근 삭제 ({deletedPhotos.length})
        </span>
        <ChevronDown
          size={14}
          className={cn('ml-auto text-muted transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div className="mt-3">
          <div className="flex gap-2">
            {deletedPhotos.map((p) => {
              const url = urlMap?.[p.storage_path]
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setConfirmId(p.id)}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl"
                  aria-label="삭제된 사진 복구"
                >
                  {url ? (
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-neutral">
                      <Loader2 size={14} className="animate-spin text-muted" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <RotateCcw size={16} className="text-white" />
                  </div>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[12px] text-placeholder">탭하면 복구할 수 있어요</p>
        </div>
      )}

      {confirmId && (
        <RestoreConfirmDialog
          onClose={() => setConfirmId(null)}
          onConfirm={() => {
            restoreMutation.mutate(confirmId)
            setConfirmId(null)
          }}
        />
      )}
    </div>
  )
}

function RestoreConfirmDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-white p-5 text-center"
      >
        <p className="text-body font-semibold text-secondary">이 사진을 복구할까요?</p>
        <p className="mt-1 text-body-sm text-muted">사진 목록에 다시 표시돼요</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl bg-surface text-body-sm font-semibold text-secondary"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 flex-1 rounded-xl bg-primary text-body-sm font-semibold text-white"
          >
            복구
          </button>
        </div>
      </div>
    </div>
  )
}
