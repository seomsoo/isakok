import { useNavigate } from 'react-router-dom'
import { Badge } from '@/shared/components/Badge'
import { ChecklistItem } from '@/shared/components/ChecklistItem'

interface OverdueSectionProps {
  items: Record<string, unknown>[]
  onToggle: (id: string, isCompleted: boolean) => void
}

/**
 * @deprecated ActionSection으로 대체됨. 타임라인 등에서 필요 시 재사용 가능.
 */
export function OverdueSection({ items, onToggle }: OverdueSectionProps) {
  const navigate = useNavigate()
  if (items.length === 0) return null

  return (
    <section className="mt-6 px-5" aria-label={`밀린 할 일 ${items.length}개`}>
      <div className="flex items-center gap-2">
        <h2 className="text-h3 font-bold text-warning">밀린 할 일</h2>
        <Badge variant="warning">{items.length}</Badge>
      </div>

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
    </section>
  )
}
