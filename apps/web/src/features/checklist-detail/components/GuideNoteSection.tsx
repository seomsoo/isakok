import { TipCard } from './TipCard'

interface GuideNoteSectionProps {
  note: string | null
  fallbackContent: string | null
  hasSteps: boolean
}

export function GuideNoteSection({ note, fallbackContent }: GuideNoteSectionProps) {
  const body = note ?? fallbackContent
  if (!body) return null

  return (
    <section>
      <TipCard body={body} />
    </section>
  )
}
