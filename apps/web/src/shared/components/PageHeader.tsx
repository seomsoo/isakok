import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title?: string
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
}

export function PageHeader({ title, left, right, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-14 items-center justify-between px-4',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {left}
        {title && (
          <h1 className="text-h3 font-bold text-secondary">{title}</h1>
        )}
      </div>
      {right && <div className="flex items-center">{right}</div>}
    </header>
  )
}
