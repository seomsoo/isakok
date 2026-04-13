import { Lightbulb } from 'lucide-react'

interface TipCardProps {
  body: string
  className?: string
}

export function TipCard({ body, className }: TipCardProps) {
  return (
    <div className={`rounded-xl  bg-tertiary/50 px-4 py-3.5 ${className ?? ''}`}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Lightbulb size={13} className="text-primary" strokeWidth={2.5} fill="currentColor" />
        <span className="text-caption font-bold uppercase tracking-wider text-primary">Tip</span>
      </div>
      <p className="whitespace-pre-line text-body-sm leading-relaxed text-secondary">{body}</p>
    </div>
  )
}
