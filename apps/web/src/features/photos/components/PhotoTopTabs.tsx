import { cn } from '@/lib/cn'
import type { PhotoType } from '@/services/photos'

interface PhotoTopTabsProps {
  value: PhotoType
  onChange: (type: PhotoType) => void
}

const TABS: { value: PhotoType; label: string }[] = [
  { value: 'move_in', label: '입주 기록' },
  { value: 'move_out', label: '퇴실 기록' },
]

export function PhotoTopTabs({ value, onChange }: PhotoTopTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="입주/퇴실 선택"
      className="mx-5 mt-3 flex h-11 rounded-xl bg-border/80 p-1"
    >
      {TABS.map((tab) => {
        const selected = value === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex-1 rounded-[10px] text-[14px] font-medium transition-all duration-200',
              selected
                ? 'bg-white text-secondary shadow-sm'
                : 'text-muted',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
