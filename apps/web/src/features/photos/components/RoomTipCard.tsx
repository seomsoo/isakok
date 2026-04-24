import { Lightbulb } from 'lucide-react'

interface RoomTipCardProps {
  tip: string
}

export function RoomTipCard({ tip }: RoomTipCardProps) {
  return (
    <div className="mx-5 flex items-start gap-2.5 rounded-xl bg-black/[0.03] px-4 py-3">
      <Lightbulb size={15} className="mt-px shrink-0 text-muted/50" />
      <p className="text-[13px] leading-relaxed tracking-tight text-muted/75">
        {tip}
      </p>
    </div>
  )
}
