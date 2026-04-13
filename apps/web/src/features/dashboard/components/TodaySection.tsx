import { useNavigate } from 'react-router-dom'
import { Badge } from '@/shared/components/Badge'
import { ChecklistItem } from '@/shared/components/ChecklistItem'

interface TodaySectionProps {
  items: Record<string, unknown>[]
  hasOverdue: boolean
  onToggle: (id: string, isCompleted: boolean) => void
}

export function TodaySection({ items, hasOverdue, onToggle }: TodaySectionProps) {
  const navigate = useNavigate()
  return (
    <section className="mt-6 px-5">
      <div className="flex items-center gap-2">
        <h2 className="text-h3 font-bold text-secondary">오늘 할 일</h2>
        {items.length > 0 && <Badge variant="count">{items.length}</Badge>}
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-surface p-4 shadow-sm">
          <p className="text-body-sm text-muted">
            {hasOverdue
              ? '밀린 할 일을 먼저 처리해보세요'
              : '지금 미리 하면 좋은 일이 있어요'}
          </p>
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl bg-surface shadow-sm">
          {items.map((item, index) => {
            const master = item.master_checklist_items as Record<string, unknown> | null
            return (
              <div key={item.id as string}>
                {index > 0 && <div className="mx-4 border-t border-border" />}
                <ChecklistItem
                  id={item.id as string}
                  title={master?.title as string ?? ''}
                  category={master?.category as string ?? ''}
                  isCompleted={item.is_completed as boolean}
                  guideType={master?.guide_type as 'tip' | 'warning' | 'critical' | undefined}
                  onToggle={onToggle}
                  onPress={() => navigate(`/checklist/${item.id as string}`)}
                />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
