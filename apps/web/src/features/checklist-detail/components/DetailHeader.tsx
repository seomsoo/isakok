import { Truck } from 'lucide-react'
import { differenceInCalendarDays } from 'date-fns'
import { Badge } from '@/shared/components/Badge'
import { getRelativeDateLabel, formatDateKorean, parseLocalDate } from '@moving/shared'

interface DetailHeaderProps {
  title: string
  category: string
  guideType: 'tip' | 'warning' | 'critical'
  assignedDate: string
  dDayOffset: number
}

// TODO: 5단계 스마트 재배치에서 모드별 날짜 표시로 교체
function getDDayTag(diffDays: number, dDayOffset: number): string | null {
  if (diffDays < 0) return null
  if (diffDays === 0) return 'D-Day'
  if (diffDays === 1) return 'D-1'
  if (dDayOffset === 0) return 'D-DAY'
  if (dDayOffset < 0) return `D${dDayOffset}`
  return `D+${dDayOffset}`
}

// TODO: 5단계 스마트 재배치에서 모드별 날짜 표시로 교체
function getDateText(diffDays: number, assignedDate: string, dDayOffset: number): string {
  if (diffDays < 0) return '지금 해도 괜찮아요'
  if (diffDays === 0) return `오늘 · ${formatDateKorean(assignedDate)}`
  if (diffDays === 1) return `내일 · ${formatDateKorean(assignedDate)}`
  return `${getRelativeDateLabel(dDayOffset)} · ${formatDateKorean(assignedDate)}`
}

export function DetailHeader({
  title,
  category,
  guideType,
  assignedDate,
  dDayOffset,
}: DetailHeaderProps) {
  const diffDays = differenceInCalendarDays(parseLocalDate(assignedDate), new Date())
  const ddayTag = getDDayTag(diffDays, dDayOffset)
  const dateText = getDateText(diffDays, assignedDate, dDayOffset)

  return (
    <header className="pt-2 pb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {ddayTag && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-0.5 text-caption font-bold text-white">
            <Truck size={12} strokeWidth={2.5} />
            {ddayTag}
          </span>
        )}
        <Badge variant="category">{category}</Badge>
        {guideType === 'critical' && <Badge variant="critical">필수</Badge>}
        {guideType === 'warning' && <Badge variant="warning">중요</Badge>}
      </div>

      <h1 className="mt-3 text-h1 font-bold leading-tight text-secondary break-keep">{title}</h1>

      <p className="mt-2 text-body-sm text-muted">{dateText}</p>
    </header>
  )
}
