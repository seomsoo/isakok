import { useState } from 'react'
import type { HousingType, ContractType, MoveType } from '@shared/types/move'
import { HOUSING_TYPES, CONTRACT_TYPES, MOVE_TYPES } from '@shared/types/move'
import type { Move } from '@/services/move'
import { Button } from '@/shared/components/Button'
import { SelectionChip } from '@/features/onboarding/components/SelectionChip'
import { CalendarPicker } from '@/features/onboarding/components/CalendarPicker'
import { useUpdateMove } from '@/features/settings/hooks/useUpdateMove'

interface MoveEditSheetProps {
  move: Move
  onClose: () => void
}

export function MoveEditSheet({ move, onClose }: MoveEditSheetProps) {
  const [movingDate, setMovingDate] = useState(move.moving_date)
  const [housingType, setHousingType] = useState<HousingType>(move.housing_type as HousingType)
  const [contractType, setContractType] = useState<ContractType>(
    move.contract_type as ContractType,
  )
  const [moveType, setMoveType] = useState<MoveType>(move.move_type as MoveType)

  const mutation = useUpdateMove()

  function handleSave() {
    mutation.mutate(
      {
        moveId: move.id,
        movingDate,
        housingType,
        contractType,
        moveType,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral">
      <header className="flex h-14 items-center justify-between px-4">
        <button
          type="button"
          onClick={onClose}
          className="text-body-sm font-medium text-muted"
        >
          취소
        </button>
        <h1 className="text-h3 font-bold text-secondary">이사 정보 수정</h1>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-28">
        {/* 이사 예정일 */}
        <section className="mt-6">
          <h2 className="text-body font-bold text-secondary">이사 예정일</h2>
          <div className="mt-3">
            <CalendarPicker selected={movingDate} onSelect={setMovingDate} />
          </div>
        </section>

        {/* 주거 유형 */}
        <section className="mt-8">
          <h2 className="text-body font-bold text-secondary">주거 유형</h2>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="주거 유형">
            {Object.values(HOUSING_TYPES).map((type) => (
              <SelectionChip
                key={type}
                label={type}
                isSelected={housingType === type}
                onSelect={() => setHousingType(type)}
                className="rounded-xl px-4 py-2.5"
              />
            ))}
          </div>
        </section>

        {/* 계약 유형 */}
        <section className="mt-8">
          <h2 className="text-body font-bold text-secondary">계약 유형</h2>
          <div className="mt-3 flex gap-2" role="radiogroup" aria-label="계약 유형">
            {Object.values(CONTRACT_TYPES).map((type) => (
              <SelectionChip
                key={type}
                label={type}
                isSelected={contractType === type}
                onSelect={() => setContractType(type)}
                className="flex-1 rounded-xl py-2.5"
              />
            ))}
          </div>
        </section>

        {/* 이사 방법 */}
        <section className="mt-8">
          <h2 className="text-body font-bold text-secondary">이사 방법</h2>
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="이사 방법">
            {Object.values(MOVE_TYPES).map((type) => (
              <SelectionChip
                key={type}
                label={type}
                isSelected={moveType === type}
                onSelect={() => setMoveType(type)}
                className="rounded-xl py-2.5"
              />
            ))}
          </div>
        </section>

        {mutation.isError && (
          <p className="mt-5 text-center text-caption text-critical" role="alert">
            저장에 실패했어요. 다시 시도해주세요.
          </p>
        )}
      </div>

      {/* 하단 저장 버튼 */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 bg-neutral px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <Button size="lg" onClick={handleSave} isLoading={mutation.isPending}>
          저장하기
        </Button>
      </div>
    </div>
  )
}
