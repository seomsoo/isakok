import { format, parseISO } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import type { Move } from '@/services/move'

interface MoveInfoSectionProps {
  move: Move
  onEdit: () => void
}

export function MoveInfoSection({ move, onEdit }: MoveInfoSectionProps) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-body-sm text-muted">이사 관리</h2>
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center justify-between rounded-2xl bg-surface p-4 shadow-sm"
      >
        <div className="text-left">
          <p className="text-body font-medium text-secondary">이사 정보 수정</p>
          <p className="mt-0.5 text-body-sm text-muted">
            {move.housing_type} · {move.contract_type} · {move.move_type}
          </p>
          <p className="text-body-sm text-muted">
            {format(parseISO(move.moving_date), 'yyyy.M.d')}
          </p>
        </div>
        <ChevronRight size={20} className="text-placeholder" />
      </button>
    </section>
  )
}
