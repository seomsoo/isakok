import { useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SectionTitle } from './SectionTitle'

interface GuideItemsSectionProps {
  items: string[]
}

export function GuideItemsSection({ items }: GuideItemsSectionProps) {
  const [packed, setPacked] = useState<Set<number>>(new Set())

  const toggle = (idx: number) => {
    setPacked((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <section>
      <SectionTitle>미리 준비할 것</SectionTitle>
      <ul role="list" className="flex flex-col">
        {items.map((item, idx) => {
          const isPacked = packed.has(idx)
          return (
            <li key={idx}>
              <button
                type="button"
                onClick={() => toggle(idx)}
                aria-pressed={isPacked}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors',
                    isPacked ? 'border-primary bg-primary' : 'border-placeholder bg-transparent',
                  )}
                >
                  {isPacked && <Check size={14} className="text-white" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    'flex-1 text-body transition-colors',
                    isPacked ? 'text-placeholder line-through' : 'text-secondary',
                  )}
                >
                  {item}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
