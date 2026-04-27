import { useRef } from 'react'
import { getConditionTags } from '@moving/shared'
import type { AiGuideConditions } from '@moving/shared'
import { TipCard } from './TipCard'
import { PersonalizedTipCard } from './PersonalizedTipCard'

interface GuideNoteSectionProps {
  note: string | null
  fallbackContent: string | null
  customGuide?: string | null
  userConditions?: AiGuideConditions | null
  itemConditions?: {
    housing_types: string[]
    contract_types: string[]
    move_types: string[]
  } | null
}

export function GuideNoteSection({
  note,
  fallbackContent,
  customGuide,
  userConditions,
  itemConditions,
}: GuideNoteSectionProps) {
  const snapshotRef = useRef<string | null | undefined>(undefined)
  if (snapshotRef.current === undefined) {
    snapshotRef.current = customGuide ?? null
  }
  const snapshotGuide = snapshotRef.current

  if (snapshotGuide && userConditions && itemConditions) {
    const tags = getConditionTags({ userConditions, itemConditions })
    return (
      <section>
        <PersonalizedTipCard tags={tags} text={snapshotGuide} />
      </section>
    )
  }

  const body = note ?? fallbackContent
  if (!body) return null

  return (
    <section>
      <TipCard body={body} />
    </section>
  )
}
