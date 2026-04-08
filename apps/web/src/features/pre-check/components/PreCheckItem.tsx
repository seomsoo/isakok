import { Check } from 'lucide-react'

interface PreCheckItemProps {
  id: string
  title: string
  isChecked: boolean
  onToggle: (id: string) => void
}

export function PreCheckItem({ id, title, isChecked, onToggle }: PreCheckItemProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-surface p-4 text-left transition-colors active:bg-neutral"
    >
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 ${
          isChecked
            ? 'scale-100 border-primary bg-primary text-white'
            : 'border-border bg-white'
        }`}
      >
        {isChecked && <Check size={14} strokeWidth={3} />}
      </div>
      <span className="text-body text-secondary">{title}</span>
    </button>
  )
}
