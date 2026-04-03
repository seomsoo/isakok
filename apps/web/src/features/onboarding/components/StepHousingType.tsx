import { useOnboardingStore } from '@/stores/onboardingStore'
import { Button } from '@/shared/components/Button'
import { HousingTypeGrid } from '@/features/onboarding/components/HousingTypeGrid'
import { CheckTip } from '@/features/onboarding/components/CheckTip'
import { OnboardingFooter } from '@/features/onboarding/components/OnboardingFooter'

interface StepHousingTypeProps {
  titleRef: React.RefObject<HTMLHeadingElement | null>
}

export function StepHousingType({ titleRef }: StepHousingTypeProps) {
  const { housingType, setHousingType, setStep } = useOnboardingStore()

  function handleNext() {
    if (housingType) {
      setStep(3)
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 pt-8 pb-28">
        <h1 ref={titleRef} tabIndex={-1} className="text-h1 font-bold tracking-tight text-secondary outline-none">
          어떤 집에서 <br />
          이사하세요?
        </h1>
        <p className="mt-2 text-body-sm text-muted">주거 유형에 맞는 체크리스트를 만들어드려요</p>

        <div className="mt-12">
          <HousingTypeGrid selected={housingType} onSelect={setHousingType} />
        </div>

        <div className="mt-6">
          <CheckTip label="Check Tip!" text="가구 수와 면적에 따라 이사 비용이 달라질 수 있어요." />
        </div>
      </div>

      <OnboardingFooter>
        <Button size="lg" disabled={!housingType} onClick={handleNext}>
          다음
        </Button>
      </OnboardingFooter>
    </>
  )
}
