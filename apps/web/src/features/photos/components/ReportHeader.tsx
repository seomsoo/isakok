import type { PhotoType } from '@/services/photos'

interface ReportHeaderProps {
  photoType: PhotoType
  earliestDate: Date | null
  totalCount: number
  memoCount: number
  roomCount: number
}

function formatDate(d: Date | null): string {
  if (!d) return ''
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function ReportHeader({
  photoType,
  earliestDate,
  totalCount,
  memoCount,
  roomCount,
}: ReportHeaderProps) {
  const typeLabel = photoType === 'move_in' ? '입주 기록' : '퇴실 기록'
  const typeSuffix = photoType === 'move_in' ? '입주' : '퇴실'
  const dateStr = formatDate(earliestDate)

  return (
    <section className="mx-4 rounded-[20px] bg-white px-5 pb-5 pt-[22px]">
      <span className="inline-flex items-center gap-1 rounded-full bg-tertiary/60 px-[9px] py-0.5 text-[12px] font-semibold text-primary">
        <span className="h-[5px] w-[5px] rounded-full bg-primary" />
        {typeLabel}
      </span>

      <h1 className="mt-2.5 text-[26px] font-bold leading-[1.2] tracking-tight text-secondary">
        {dateStr ? `${dateStr} ${typeSuffix}` : typeSuffix}
        <br />
        집 상태 리포트
      </h1>

      <div className="mt-3.5 text-[14px] tabular-nums tracking-tight text-muted">
        사진 <span className="font-semibold text-secondary">{totalCount}장</span>
        <span className="mx-1.5 opacity-50">·</span>
        메모 <span className="font-semibold text-secondary">{memoCount}개</span>
        <span className="mx-1.5 opacity-50">·</span>
        공간 <span className="font-semibold text-secondary">{roomCount}곳</span>
      </div>
    </section>
  )
}
