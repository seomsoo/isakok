import { Check, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'

interface CompletionToggleButtonProps {
  isCompleted: boolean
  isPending: boolean
  onToggle: () => void
}

export function CompletionToggleButton({
  isCompleted,
  isPending,
  onToggle,
}: CompletionToggleButtonProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto max-w-[430px] px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <button
          type="button"
          onClick={onToggle}
          disabled={isPending}
          className={cn(
            'flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-body font-semibold transition-colors disabled:opacity-60',
            isCompleted
              ? 'bg-neutral text-secondary ring-1 ring-border active:bg-border/60'
              : 'bg-primary text-white active:bg-primary/90',
          )}
        >
          {isCompleted ? (
            <>
              <RotateCcw size={18} strokeWidth={2.5} />
              다시 할 일로 되돌리기
            </>
          ) : (
            <>
              <Check size={18} strokeWidth={3} />
              완료로 표시
            </>
          )}
        </button>
      </div>
    </div>
  )
}
