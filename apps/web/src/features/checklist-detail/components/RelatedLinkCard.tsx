import { ArrowUpRight, Globe } from 'lucide-react'
import { getLinkMeta } from '@moving/shared'
import { SectionTitle } from './SectionTitle'

interface RelatedLinkCardProps {
  url: string
}

export function RelatedLinkCard({ url }: RelatedLinkCardProps) {
  const meta = getLinkMeta(url)

  return (
    <section>
      <SectionTitle>바로가기</SectionTitle>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${meta.name} 열기`}
        className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-border transition-colors active:bg-neutral"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tertiary/60">
          <Globe size={18} className="text-primary" strokeWidth={2.2} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-semibold text-secondary">{meta.name}</span>
          <span className="truncate text-body-sm text-muted">{meta.description}</span>
        </div>
        <ArrowUpRight size={18} className="shrink-0 text-muted" />
      </a>
    </section>
  )
}
