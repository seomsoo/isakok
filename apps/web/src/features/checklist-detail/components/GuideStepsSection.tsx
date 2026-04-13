import { cn } from '@/lib/cn'
import { SectionTitle } from './SectionTitle'
import { TipCard } from './TipCard'

interface GuideStepsSectionProps {
  steps: string[]
  tip?: string | null
}

export function GuideStepsSection({ steps, tip }: GuideStepsSectionProps) {
  return (
    <section className="mt-3">
      <SectionTitle>이렇게 하세요</SectionTitle>
      <ol role="list" className="flex flex-col">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1
          return (
            <li key={idx} className="flex gap-3.5">
              <div className="relative flex w-7 shrink-0 flex-col items-center">
                <span className="z-10 flex h-7 w-7 items-center justify-center rounded-full bg-tertiary text-body-sm font-bold text-primary">
                  {idx + 1}
                </span>
                {!isLast && <span aria-hidden className="my-1.5 w-0.5 flex-1 bg-border" />}
              </div>
              <p
                className={cn(
                  'flex-1 pt-0.5 text-body leading-relaxed text-secondary break-keep',
                  !isLast && 'pb-5',
                )}
              >
                {step}
              </p>
            </li>
          )
        })}
      </ol>

      {tip && <TipCard body={tip} className="mt-7" />}
    </section>
  )
}
