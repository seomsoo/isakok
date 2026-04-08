import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from './Badge'

interface ChecklistItemProps {
  id: string
  title: string
  category?: string
  isCompleted: boolean
  guideType?: 'tip' | 'warning' | 'critical'
  dateLabel?: string
  onToggle: (id: string, isCompleted: boolean) => void
  onPress?: () => void
}

export function ChecklistItem({
  id,
  title,
  category,
  isCompleted,
  guideType,
  dateLabel,
  onToggle,
  onPress,
}: ChecklistItemProps) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-3">
      {/* 체크박스 */}
      <button
        type="button"
        role="checkbox"
        aria-checked={isCompleted}
        aria-label={`${title} 완료 처리`}
        onClick={() => onToggle(id, !isCompleted)}
        className="flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <div
          className={cn(
            'flex h-[22px] w-[22px] items-center justify-center rounded-full transition-colors',
            isCompleted
              ? 'border-[1.5px] border-primary bg-primary'
              : 'border-[1.5px] border-placeholder bg-transparent',
          )}
        >
          {isCompleted && <Check size={13} className="text-white" strokeWidth={3} />}
        </div>
      </button>

      {/* 내용 */}
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5"
        onClick={onPress}
        disabled={!onPress}
      >
        <span
          className={cn(
            'text-body-lg leading-snug font-medium',
            isCompleted ? 'text-placeholder line-through' : 'text-secondary',
          )}
        >
          {title}
        </span>
        {category && (
          <div className="flex items-center gap-1.5">
            <Badge variant="category">{category}</Badge>
          </div>
        )}
        {dateLabel && <span className="text-label text-muted">{dateLabel}</span>}
      </button>

      {/* 우측 */}
      <div className="flex shrink-0 items-center gap-1.5">
        {guideType === 'critical' && <Badge variant="critical">필수</Badge>}
        {guideType === 'warning' && <Badge variant="warning">중요</Badge>}
        {onPress && <ChevronRight size={18} className="text-placeholder" />}
      </div>
    </div>
  )
}
