import { cn } from '@/lib/cn'

interface SelectionChipProps {
  label: string
  isSelected: boolean
  onSelect: () => void
  icon?: React.ReactNode
  className?: string
}

export function SelectionChip({
  label,
  isSelected,
  onSelect,
  icon,
  className,
}: SelectionChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={cn(
        'flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4  transition-all duration-150',
        isSelected
          ? 'border-[1.5px] border-primary bg-tertiary font-semibold text-primary'
          : 'border-border-input bg-surface font-normal text-secondary',
        className,
      )}
    >
      {icon && <span className="flex h-5 w-5 items-center justify-center">{icon}</span>}
      {label}
    </button>
  )
}
