import { useEffect } from 'react'

interface DeletePhotoDialogProps {
  isOpen: boolean
  overflow?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DeletePhotoDialog({ isOpen, overflow, onClose, onConfirm }: DeletePhotoDialogProps) {
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-describedby="delete-photo-desc"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[calc(100%-0px)] animate-[slideUp_200ms_ease] rounded-2xl bg-white"
      >
        <div className="px-6 pt-7 pb-5 text-center">
          <p className="text-[17px] font-bold tracking-tight text-secondary">
            이 사진을 삭제할까요?
          </p>
          <p
            id="delete-photo-desc"
            className="mt-2 text-[14px] leading-relaxed tracking-tight text-muted/70"
          >
            {overflow ? (
              <>
                최근 삭제가 가득 찼어요.
                <br />
                가장 오래된 사진 1장이 영구삭제돼요.
              </>
            ) : (
              '최근 삭제에서 복구할 수 있어요.'
            )}
          </p>
        </div>

        <div className="flex gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="h-[52px] flex-1 rounded-xl bg-black/[0.04] text-[15px] font-semibold tracking-tight text-secondary active:bg-black/[0.08] transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="h-[52px] flex-1 rounded-xl bg-critical text-[15px] font-semibold tracking-tight text-white active:bg-critical/90 transition-colors"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
