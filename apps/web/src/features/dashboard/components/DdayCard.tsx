import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { PROGRESS_LABEL, type UrgencyMode } from '@moving/shared'
import { CircularProgress } from '@/shared/components/CircularProgress'

interface DdayCardProps {
  daysRemaining: number
  movingDate: string
  completed: number
  total: number
  mode: UrgencyMode
}

function formatDday(days: number): string {
  if (days === 0) return 'D-Day'
  if (days > 0) return `D-${days}`
  return `D+${Math.abs(days)}`
}

export function DdayCard({ daysRemaining, movingDate, completed, total, mode }: DdayCardProps) {
  const isEssentialMode = mode === 'urgent' || mode === 'critical'
  const label = isEssentialMode ? '필수' : '완료'
  const ariaLabel = `진행률 ${PROGRESS_LABEL[mode](completed, total)}`

  return (
    <div className="mx-5 rounded-2xl bg-primary p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="mt-1 text-body-sm text-white/70">새 집으로 이사까지</p>
          <p className="text-5xl font-bold text-white">{formatDday(daysRemaining)}</p>
          <p className="mt-0.5 text-body-sm text-white/70">
            {format(parseISO(movingDate), 'yyyy년 M월 d일 (E)', { locale: ko })}
          </p>
        </div>

        <div className="relative">
          <CircularProgress
            completed={completed}
            total={total}
            size={102}
            strokeWidth={9}
            label={label}
            ariaLabel={ariaLabel}
          />
        </div>
      </div>
    </div>
  )
}
