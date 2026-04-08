import { cn } from '@/lib/cn'

interface BadgeProps {
  variant: 'category' | 'critical' | 'warning' | 'count' | 'today'
  children: React.ReactNode
  className?: string
}

const VARIANT_STYLES: Record<BadgeProps['variant'], string> = {
  category: 'bg-tertiary text-primary',
  critical: 'bg-critical/10 text-critical',
  warning: 'bg-warning/10 text-warning',
  count: 'bg-tertiary text-primary',
  today: 'bg-primary text-white',
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-2 py-0.5 text-caption font-semibold',
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
