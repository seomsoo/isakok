import { useState } from 'react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface CompletedSectionProps {
  items: Record<string, unknown>[]
  onToggle: (id: string, isCompleted: boolean) => void
}

export function CompletedSection({ items, onToggle }: CompletedSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="mx-5 mt-4 mb-6 overflow-hidden rounded-2xl bg-border/50">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 px-4 py-3.5"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success">
          <Check size={12} className="text-white" strokeWidth={3} />
        </div>
        <span className="flex-1 text-left text-body-sm font-medium text-muted">완료</span>
        <span className="text-body-sm text-muted">{items.length}개</span>
        {isOpen ? (
          <ChevronDown size={16} className="text-muted" />
        ) : (
          <ChevronRight size={16} className="text-muted" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-border/80">
          {items.map((item, index) => {
            const master = item.master_checklist_items as Record<string, unknown> | null
            return (
              <div key={item.id as string}>
                {index > 0 && <div className="mx-4 border-t border-border/60" />}
                <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={true}
                    aria-label={`${master?.title as string} 미완료로 변경`}
                    onClick={() => onToggle(item.id as string, false)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <div
                      className={cn(
                        'flex h-[22px] w-[22px] items-center justify-center rounded-full',
                        'border-[1.5px] border-primary bg-primary',
                      )}
                    >
                      <Check size={13} className="text-white" strokeWidth={3} />
                    </div>
                  </button>
                  <span className="min-w-0 flex-1 truncate text-body text-placeholder line-through">
                    {(master?.title as string) ?? ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
