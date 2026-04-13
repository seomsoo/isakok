import { Lightbulb, X } from 'lucide-react'

interface ModeTransitionBannerProps {
  message: string
  onDismiss: () => void
}

export function ModeTransitionBanner({ message, onDismiss }: ModeTransitionBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-5 mb-3 flex items-start gap-2 rounded-xl bg-tertiary px-4 py-3"
    >
      <Lightbulb size={16} className="mt-0.5 shrink-0 text-primary" />
      <p className="flex-1 text-body-sm text-secondary">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="안내 닫기"
        className="shrink-0 text-muted"
      >
        <X size={16} />
      </button>
    </div>
  )
}
