import { Sparkles } from 'lucide-react'

interface PersonalizedTipCardProps {
  tags: string[]
  text: string
  className?: string
}

export function PersonalizedTipCard({ tags, text, className }: PersonalizedTipCardProps) {
  return (
    <div
      role="note"
      className={`relative rounded-xl bg-tertiary/50 py-3.5 pl-5 pr-4 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:rounded-l-xl before:bg-primary ${className ?? ''}`}
    >
      {tags.length > 0 && (
        <div className="mb-2 flex items-center gap-1.5" aria-label="맞춤 조건">
          {tags.map((tag, i) => (
            <span key={tag} className="inline-flex items-center">
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption text-secondary/70">
                {tag}
              </span>
              {i < tags.length - 1 && (
                <span className="mx-1 text-secondary/40" aria-hidden="true">
                  ·
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="mb-1.5 flex items-center gap-1.5">
        <Sparkles size={13} className="text-primary" strokeWidth={2.5} aria-hidden="true" />
        <span className="text-caption font-bold uppercase tracking-wider text-primary">
          맞춤 팁
        </span>
      </div>
      <p className="whitespace-pre-line text-body-sm leading-relaxed text-secondary">{text}</p>
    </div>
  )
}
