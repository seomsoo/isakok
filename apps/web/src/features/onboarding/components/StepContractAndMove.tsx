import type { ContractType, MoveType } from '@shared/types/move'
import { Truck, PackageOpen, PackageCheck, Car, CreditCard, House } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useCreateMove } from '@/features/onboarding/hooks/useCreateMove'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { Button } from '@/shared/components/Button'
import { SelectionChip } from '@/features/onboarding/components/SelectionChip'
import { CheckTip } from '@/features/onboarding/components/CheckTip'
import { OnboardingFooter } from '@/features/onboarding/components/OnboardingFooter'
import { OfflineBanner } from '@/shared/components/OfflineBanner'

const CONTRACT_OPTIONS: { value: ContractType; label: string; icon: React.ReactNode }[] = [
  { value: '월세', label: '월세', icon: <CreditCard size={22} strokeWidth={1.5} /> },
  { value: '전세', label: '전세', icon: <House size={22} strokeWidth={1.5} /> },
]

const MOVE_OPTIONS: { value: MoveType; label: string; icon: React.ReactNode }[] = [
  { value: '용달', label: '용달', icon: <Truck size={20} strokeWidth={1.5} /> },
  { value: '반포장', label: '반포장', icon: <PackageOpen size={20} strokeWidth={1.5} /> },
  { value: '포장', label: '포장', icon: <PackageCheck size={20} strokeWidth={1.5} /> },
  { value: '자가용', label: '자가용', icon: <Car size={20} strokeWidth={1.5} /> },
]

const MOVE_TIPS: Record<MoveType, string> = {
  용달: '짐이 적으면 가장 경제적이에요. 직접 짐을 옮겨야 해요.',
  반포장: '가전/가구는 업체가, 잔짐은 직접 포장해요.',
  포장: '모든 짐 포장을 업체가 해줘요. 편하지만 비용이 높아요.',
  자가용: '정말 짐이 몇 박스일 때만 추천해요.',
}

interface StepContractAndMoveProps {
  titleRef: React.RefObject<HTMLHeadingElement | null>
}

export function StepContractAndMove({ titleRef }: StepContractAndMoveProps) {
  const { movingDate, housingType, contractType, moveType, setContractType, setMoveType } =
    useOnboardingStore()
  const mutation = useCreateMove()
  const isOnline = useOnlineStatus()

  const canSubmit = contractType && moveType && isOnline

  function handleSubmit() {
    if (!movingDate || !housingType || !contractType || !moveType) return

    mutation.mutate({
      movingDate,
      housingType,
      contractType,
      moveType,
    })
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 pt-8 pb-28">
        {/* 계약 유형 */}
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="text-h1 font-bold tracking-tight text-secondary outline-none"
        >
          계약 유형은?
        </h1>
        <p className="mt-2 text-body-sm text-muted">현재 살고 있는 집의 계약 유형이에요</p>
        <div className="mt-5 flex gap-2" role="radiogroup" aria-label="계약 유형 선택">
          {CONTRACT_OPTIONS.map((option) => (
            <SelectionChip
              key={option.value}
              label={option.label}
              icon={option.icon}
              isSelected={contractType === option.value}
              onSelect={() => setContractType(option.value)}
              className="h-32 flex-1 flex-col gap-3 rounded-2xl text-body"
            />
          ))}
        </div>

        {/* 이사 방법 */}
        <div className="mt-10">
          <h2 className="text-h1 font-bold tracking-tight text-secondary">이사 방법은?</h2>
          <div
            className="mt-5 grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="이사 방법 선택"
          >
            {MOVE_OPTIONS.map((option) => (
              <SelectionChip
                key={option.value}
                label={option.label}
                icon={option.icon}
                isSelected={moveType === option.value}
                onSelect={() => setMoveType(option.value)}
                className="h-28 flex-col gap-2 rounded-2xl text-body"
              />
            ))}
          </div>
        </div>

        {/* 팁 */}
        {moveType && (
          <div className="mt-8">
            <CheckTip label="Pro Tip!" text={MOVE_TIPS[moveType]} />
          </div>
        )}

        {/* 에러 메시지 */}
        {mutation.isError && (
          <p className="mt-5 text-center text-caption text-critical" role="alert">
            체크리스트 생성에 실패했어요. 다시 시도해주세요.
          </p>
        )}
      </div>

      <OnboardingFooter>
        <OfflineBanner />

        <Button
          size="lg"
          disabled={!canSubmit}
          isLoading={mutation.isPending}
          onClick={handleSubmit}
        >
          맞춤 체크리스트 만들기
        </Button>
      </OnboardingFooter>
    </>
  )
}
