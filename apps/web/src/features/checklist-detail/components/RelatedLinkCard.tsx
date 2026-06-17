import { ArrowUpRight, Globe } from 'lucide-react'
import { getLinkMeta, isNativeWebView, sendToNative } from '@moving/shared'
import { SectionTitle } from './SectionTitle'

interface RelatedLinkCardProps {
  url: string
}

function handleLinkClick(e: React.MouseEvent, url: string) {
  if (isNativeWebView()) {
    e.preventDefault()
    sendToNative({ type: 'OPEN_EXTERNAL_LINK', payload: { url } })
  }
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
        aria-label={`${meta.name} 새 창에서 열기`}
        onClick={(e) => handleLinkClick(e, url)}
        className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-border transition-colors duration-100 active:bg-neutral motion-reduce:transition-none"
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
