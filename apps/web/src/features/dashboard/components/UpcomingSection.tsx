import { differenceInCalendarDays, parseISO } from 'date-fns'
import { ROUTES } from '@shared/constants/routes'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { UrgencyMode } from '@moving/shared'

interface UpcomingSectionProps {
  items: Record<string, unknown>[]
  mode: UrgencyMode
}

interface GroupedItems {
  label: string
  items: Record<string, unknown>[]
}

function groupByTimeframe(items: Record<string, unknown>[]): GroupedItems[] {
  const groups: Record<string, Record<string, unknown>[]> = {}

  for (const item of items) {
    const daysUntil = differenceInCalendarDays(parseISO(item.assigned_date as string), new Date())

    let label: string
    if (daysUntil <= 1) label = '내일'
    else if (daysUntil <= 7) label = '이번 주'
    else label = '다음 주'

    const group = groups[label]
    if (group) {
      group.push(item)
    } else {
      groups[label] = [item]
    }
  }

  const order = ['내일', '이번 주', '다음 주']
  return order
    .filter((label) => groups[label])
    .map((label) => ({ label, items: groups[label] ?? [] }))
}

export function UpcomingSection({ items, mode }: UpcomingSectionProps) {
  if (mode === 'urgent' || mode === 'critical') return null
  if (items.length === 0) return null

  const preview = items.slice(0, 6)
  const grouped = groupByTimeframe(preview)

  return (
    <section className="mt-8 px-5">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 font-bold text-secondary">미리 준비하면 좋아요</h2>
        <Link
          to={ROUTES.TIMELINE}
          className="flex items-center gap-0.5 text-body-sm font-medium text-primary"
        >
          전체 보기
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-5  ">
        {grouped.map((group) => (
          <div key={group.label} className="bg-tertiary/60 rounded-xl px-5 py-3 transition-colors">
            <p className="text-body-sm font-semibold text-muted ">{group.label}</p>
            <div className="mt-2 flex flex-col ">
              {group.items.map((item) => {
                const master = item.master_checklist_items as Record<string, unknown> | null

                return (
                  <div
                    key={item.id as string}
                    className=" flex border-l-4 border-primary/30  items-center gap-2.5 rounded-l-none rounded-xl px-2 py-1 transition-colors  active:bg-secondary/5"
                  >
                    <p className="text-body font-medium text-secondary">
                      {(master?.title as string) ?? ''}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
