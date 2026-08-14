import { forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { checklistDetailPath } from '@shared/constants/routes'
import { cn } from '@/lib/cn'
import { ChecklistItem } from '@/shared/components/ChecklistItem'
import { sortByGuidePriority } from '@/shared/utils/sortByGuidePriority'
import { getDateLabel } from '@/features/timeline/hooks/useTimelineItems'
import type { PeriodGroup } from '@/features/timeline/hooks/useTimelineItems'
import type { ChecklistItemWithMaster } from '@/services/checklist'

interface PeriodSectionProps {
  period: PeriodGroup
  movingDate: string
  onToggleItem: (id: string, isCompleted: boolean) => void
}

/**
 * 같은 날짜끼리 묶어서 날짜 서브헤더 + 아이템 리스트로 렌더링
 * 각 날짜 그룹 내에서 guide_type 우선순위로 정렬 (critical > warning > tip)
 */
function groupItemsByDate(
  items: ChecklistItemWithMaster[],
  movingDate: string,
): { label: string; items: ChecklistItemWithMaster[] }[] {
  const groups: { label: string; items: ChecklistItemWithMaster[] }[] = []

  for (const item of items) {
    const label = getDateLabel(item.assigned_date, movingDate)
    const lastGroup = groups[groups.length - 1]

    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(item)
    } else {
      groups.push({ label, items: [item] })
    }
  }

  return groups.map((g) => ({ ...g, items: sortByGuidePriority(g.items) }))
}

export const PeriodSection = forwardRef<HTMLDivElement, PeriodSectionProps>(function PeriodSection(
  { period, movingDate, onToggleItem },
  ref,
) {
  const allItems = [...period.overdueItems, ...period.items].sort((a, b) =>
    a.assigned_date.localeCompare(b.assigned_date),
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
          {group.items.map((item) => (
            <ChecklistItem
              key={item.id}
              id={item.id}
              title={item.master_checklist_items?.title ?? ''}
              isCompleted={item.is_completed}
              guideType={item.master_checklist_items?.guide_type}
              onToggle={onToggleItem}
              onPress={() => navigate(checklistDetailPath(item.id, 'timeline'))}
            />
          ))}
        </div>
      ))}
    </div>
  )
})
