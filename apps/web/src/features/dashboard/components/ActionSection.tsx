import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { ROUTES, ACTION_SECTION_TITLE, type UrgencyMode } from '@moving/shared'
import { Badge } from '@/shared/components/Badge'

interface ActionSectionProps {
  items: Record<string, unknown>[]
  nextUpcomingDate?: string
  mode: UrgencyMode
  onToggle: (id: string, isCompleted: boolean) => void
}

const GUIDE_PRIORITY: Record<string, number> = {
  critical: 0,
  warning: 1,
  tip: 2,
}

function sortByUrgency(items: Record<string, unknown>[]) {
  return [...items].sort((a, b) => {
    const masterA = a.master_checklist_items as Record<string, unknown> | null
    const masterB = b.master_checklist_items as Record<string, unknown> | null
    const priorityA = GUIDE_PRIORITY[masterA?.guide_type as string] ?? 3
    const priorityB = GUIDE_PRIORITY[masterB?.guide_type as string] ?? 3
    if (priorityA !== priorityB) return priorityA - priorityB
    return (a.assigned_date as string).localeCompare(b.assigned_date as string)
  })
}

export function ActionSection({ items, nextUpcomingDate, mode, onToggle }: ActionSectionProps) {
  // 초급한 모드: 필수 항목만
  const filtered = mode === 'critical'
    ? items.filter((item) => {
        const master = item.master_checklist_items as Record<string, unknown> | null
        return master?.is_skippable === false
      })
    : items

  if (filtered.length === 0) {
    return (
      <section className="mt-6 px-5">
        <div className="rounded-2xl bg-surface p-5 text-center shadow-sm">
          <p className="text-body font-medium text-secondary">모든 일정이 순조로워요</p>
          {nextUpcomingDate && (
            <p className="mt-1 text-body-sm text-muted">다음 할 일은 {nextUpcomingDate}에 있어요</p>
          )}
        </div>
      </section>
    )
  }

  const sorted = sortByUrgency(filtered)
  const maxVisible = mode === 'urgent' || mode === 'critical' ? 5 : 3
  const visible = sorted.slice(0, maxVisible)

  return (
    <section className="mt-2 px-5">
      <div className="flex justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-h3 font-bold text-secondary">{ACTION_SECTION_TITLE[mode]}</h2>
          <Badge variant="count">{filtered.length}</Badge>
        </div>
        <Link
          to={ROUTES.TIMELINE}
          className="flex items-center gap-1 py-3 text-body-sm font-medium text-primary"
        >
          전체 보기
          <ChevronRight size={16} />
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {visible.map((item) => {
          const master = item.master_checklist_items as Record<string, unknown> | null
          const guideType = master?.guide_type as string

          return (
            <Link
              key={item.id as string}
              to={`/checklist/${item.id as string}`}
              className="flex items-center gap-3 rounded-2xl bg-surface py-7 px-4"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={false}
                aria-label={`${master?.title as string} 완료 처리`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggle(item.id as string, true)
                }}
                className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-border transition-all active:scale-90"
              />
              <p className="min-w-0 flex-1 truncate text-body font-medium text-secondary">
                {master?.title as string}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                {guideType === 'critical' && (
                  <Badge variant="critical" className="px-1.5 text-xs">
                    필수
                  </Badge>
                )}
                {guideType === 'warning' && (
                  <Badge variant="warning" className="px-1.5 text-xs">
                    중요
                  </Badge>
                )}
                <Badge variant="category" className="px-1.5 text-xs">
                  {master?.category as string}
                </Badge>
              </div>
              <ChevronRight size={18} className="shrink-0 text-placeholder" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
