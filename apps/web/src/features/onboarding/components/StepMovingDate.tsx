import { useOnboardingStore } from '@/stores/onboardingStore'
import { Button } from '@/shared/components/Button'
import { CalendarPicker } from '@/features/onboarding/components/CalendarPicker'
import { OnboardingFooter } from '@/features/onboarding/components/OnboardingFooter'

interface StepMovingDateProps {
  titleRef: React.RefObject<HTMLHeadingElement | null>
}

export function StepMovingDate({ titleRef }: StepMovingDateProps) {
  const { movingDate, setMovingDate, setStep } = useOnboardingStore()

  function handleNext() {
    if (movingDate) {
      setStep(2)
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 pt-8 pb-28">
        <h1 ref={titleRef} tabIndex={-1} className="text-h1 font-bold tracking-tight text-secondary outline-none">
          이사 예정일이
          <br />
          언제예요?
        </h1>
        <p className="mt-2 text-body-sm text-muted">날짜 기준으로 할 일을 자동 배치해드려요</p>

        <div className="mt-12">
          <CalendarPicker selected={movingDate} onSelect={setMovingDate} />
        </div>
      </div>

      <OnboardingFooter>
        <Button size="lg" disabled={!movingDate} onClick={handleNext}>
          다음
        </Button>
      </OnboardingFooter>
    </>
  )
}
