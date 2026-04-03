import { BedSingle, Building2, House, Building, DoorOpen } from 'lucide-react'
import type { HousingType } from '@shared/types/move'
import { cn } from '@/lib/cn'

interface HousingTypeGridProps {
  selected: HousingType | null
  onSelect: (type: HousingType) => void
}

const LEFT_OPTIONS: { type: HousingType; label: string; icon: typeof BedSingle }[] = [
  { type: '원룸', label: '원룸', icon: BedSingle },
  { type: '투룸+', label: '투룸+', icon: DoorOpen },
]

const RIGHT_OPTIONS: { type: HousingType; label: string; icon: typeof BedSingle }[] = [
  { type: '오피스텔', label: '오피스텔', icon: Building2 },
  { type: '빌라', label: '빌라', icon: House },
  { type: '아파트', label: '아파트', icon: Building },
]

function HousingCard({
  label,
  icon: Icon,
  isSelected,
  onSelect,
  className,
}: {
  label: string
  icon: typeof BedSingle
  isSelected: boolean
  onSelect: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={cn(
        'relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border transition-colors duration-150',
        isSelected ? 'border-[1.5px] border-primary bg-tertiary' : 'border-border-input bg-surface',
        className,
      )}
    >
      <Icon
        className={cn('transition-colors', isSelected ? 'text-primary' : 'text-placeholder')}
        size={24}
        strokeWidth={1.5}
      />
      <span
        className={cn(
          'mt-2 text-caption font-medium transition-colors',
          isSelected ? 'text-primary' : 'text-secondary',
        )}
      >
        {label}
      </span>
    </button>
  )
}

export function HousingTypeGrid({ selected, onSelect }: HousingTypeGridProps) {
  return (
    <div role="radiogroup" aria-label="주거 유형 선택" className="grid h-80 grid-cols-2 gap-2">
      {/* 왼쪽 열: 원룸(크게) + 투룸+(작게) */}
      <div className="flex flex-col gap-2">
        {LEFT_OPTIONS.map((option, i) => (
          <HousingCard
            key={option.type}
            {...option}
            isSelected={selected === option.type}
            onSelect={() => onSelect(option.type)}
            className={i === 0 ? 'flex-3' : 'flex-2'}
          />
        ))}
      </div>

      {/* 오른쪽 열: 오피스텔/빌라/아파트 균일 */}
      <div className="flex flex-col gap-2">
        {RIGHT_OPTIONS.map((option) => (
          <HousingCard
            key={option.type}
            {...option}
            isSelected={selected === option.type}
            onSelect={() => onSelect(option.type)}
            className="flex-1"
          />
        ))}
      </div>
    </div>
  )
}
