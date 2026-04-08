import { cn } from '@/lib/cn'

interface CheckTipProps {
  label: string
  text: string
  className?: string
}

export function CheckTip({ label, text, className }: CheckTipProps) {
  return (
    <div className={cn('rounded-2xl bg-tertiary px-4 py-4', className)}>
      <p className="text-xs font-medium text-primary">{label}</p>
      <p className="mt-1 text-label leading-relaxed text-muted">{text}</p>
    </div>
  )
}
