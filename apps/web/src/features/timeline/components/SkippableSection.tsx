import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CRITICAL_SKIPPABLE_HINT, URGENCY_GROUP_LABELS } from '@moving/shared'
import { ChecklistItem } from '@/shared/components/ChecklistItem'

interface SkippableSectionProps {
  items: Record<string, unknown>[]
  mode: 'urgent' | 'critical'
  onToggle: (id: string, isCompleted: boolean) => void
}

export function SkippableSection({ items, mode, onToggle }: SkippableSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  if (items.length === 0) return null

  const listId = 'skippable-list'

  return (
    <div className="mx-5 mt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={listId}
        className="flex w-full items-center gap-2 rounded-xl bg-border/40 px-4 py-3"
      >
        {isOpen ? (
          <ChevronUp size={16} className="text-muted" />
        ) : (
          <ChevronDown size={16} className="text-muted" />
        )}
        <span className="flex-1 text-left text-body-sm font-medium text-muted">
          {URGENCY_GROUP_LABELS.canSkip}
        </span>
        <span className="rounded-full bg-border px-2 text-caption text-muted">{items.length}</span>
      </button>

      {isOpen && (
        <div id={listId} className="mt-2">
          {items.map((item) => {
            const master = item.master_checklist_items as Record<string, unknown> | null
            return (
              <ChecklistItem
                key={item.id as string}
                id={item.id as string}
                title={(master?.title as string) ?? ''}
                isCompleted={item.is_completed as boolean}
                guideType={master?.guide_type as 'tip' | 'warning' | 'critical' | undefined}
                onToggle={onToggle}
                onPress={() => navigate(`/checklist/${item.id as string}`)}
              />
            )
          })}
        </div>
      )}

      {mode === 'critical' && (
        <p role="note" className="px-4 py-2 text-body-sm text-muted">
          {CRITICAL_SKIPPABLE_HINT}
        </p>
      )}
    </div>
  )
}
