import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CircularProgress } from '@/shared/components/CircularProgress'

interface DdayCardProps {
  daysRemaining: number
  movingDate: string
  completed: number
  total: number
}

function formatDday(days: number): string {
  if (days === 0) return 'D-Day'
  if (days > 0) return `D-${days}`
  return `D+${Math.abs(days)}`
}

export function DdayCard({ daysRemaining, movingDate, completed, total }: DdayCardProps) {
  return (
    <div className="mx-5 rounded-2xl bg-primary p-5">
      <div className="flex items-start justify-between">
        {/* 좌측: D-Day + 날짜 */}
        <div>
          <p className="mt-1 text-body-sm text-white/70">새 집으로 이사까지</p>
          <p className="text-5xl font-bold text-white">{formatDday(daysRemaining)}</p>

          <p className="mt-0.5 text-body-sm text-white/70">
            {format(parseISO(movingDate), 'yyyy년 M월 d일 (E)', { locale: ko })}
          </p>
        </div>

        {/* 우측: 원형 진행률 */}
        <div className="relative ">
          <CircularProgress completed={completed} total={total} size={102} strokeWidth={9} />
        </div>
      </div>
    </div>
  )
}
