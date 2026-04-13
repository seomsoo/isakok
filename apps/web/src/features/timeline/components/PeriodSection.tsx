import { forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { ChecklistItem } from '@/shared/components/ChecklistItem'
import { getDateLabel } from '@/features/timeline/hooks/useTimelineItems'
import type { PeriodGroup } from '@/features/timeline/hooks/useTimelineItems'

interface PeriodSectionProps {
  period: PeriodGroup
  movingDate: string
  onToggleItem: (id: string, isCompleted: boolean) => void
}

const GUIDE_PRIORITY: Record<string, number> = {
  critical: 0,
  warning: 1,
  tip: 2,
}

function sortByGuideType(items: Record<string, unknown>[]) {
  return [...items].sort((a, b) => {
    const masterA = a.master_checklist_items as Record<string, unknown> | null
    const masterB = b.master_checklist_items as Record<string, unknown> | null
    return (
      (GUIDE_PRIORITY[masterA?.guide_type as string] ?? 3) -
      (GUIDE_PRIORITY[masterB?.guide_type as string] ?? 3)
    )
  })
}

/**
 * 같은 날짜끼리 묶어서 날짜 서브헤더 + 아이템 리스트로 렌더링
 * 각 날짜 그룹 내에서 guide_type 우선순위로 정렬 (critical > warning > tip)
 */
function groupItemsByDate(
  items: Record<string, unknown>[],
  movingDate: string,
): { label: string; items: Record<string, unknown>[] }[] {
  const groups: { label: string; items: Record<string, unknown>[] }[] = []

  for (const item of items) {
    const label = getDateLabel(item.assigned_date as string, movingDate)
    const lastGroup = groups[groups.length - 1]

    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(item)
    } else {
      groups.push({ label, items: [item] })
    }
  }

  return groups.map((g) => ({ ...g, items: sortByGuideType(g.items) }))
}

export const PeriodSection = forwardRef<HTMLDivElement, PeriodSectionProps>(function PeriodSection(
  { period, movingDate, onToggleItem },
  ref,
) {
  const allItems = [...period.overdueItems, ...period.items].sort((a, b) =>
    (a.assigned_date as string).localeCompare(b.assigned_date as string),
  )
  const dateGroups = groupItemsByDate(allItems, movingDate)
  const navigate = useNavigate()

  return (
    <div ref={ref}>
      {/* 기간 헤더 */}
      <div className="flex items-center justify-between px-5 pb-1 pt-5">
        <span
          className={cn(
            'text-body-md font-medium',
            period.isCurrent ? 'text-secondary' : 'text-muted',
          )}
        >
          {period.label}
        </span>
        <span
          className={cn(
            'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-caption font-medium',
            period.isCurrent ? 'bg-tertiary text-primary' : 'bg-border text-muted',
          )}
        >
          {period.totalCount}
        </span>
      </div>

      {/* 날짜별 서브그룹 */}
      {dateGroups.map((group, idx) => (
        <div key={`${group.label}-${idx}`}>
          {/* 날짜 서브헤더 */}
          <div className="flex items-center gap-2 px-5 pt-3 pb-0.5">
            <span className="text-label font-medium text-muted">{group.label}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* 아이템 */}
          {group.items.map((item) => {
            const master = item.master_checklist_items as Record<string, unknown> | null
            return (
              <ChecklistItem
                key={item.id as string}
                id={item.id as string}
                title={(master?.title as string) ?? ''}
                isCompleted={item.is_completed as boolean}
                guideType={master?.guide_type as 'tip' | 'warning' | 'critical' | undefined}
                onToggle={onToggleItem}
                onPress={() => navigate(`/checklist/${item.id as string}`)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
})
