import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { ROUTES } from '@shared/constants/routes'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { ProgressBar } from '@/shared/components/ProgressBar'
import { StepMovingDate } from '@/features/onboarding/components/StepMovingDate'
import { StepHousingType } from '@/features/onboarding/components/StepHousingType'
import { StepContractAndMove } from '@/features/onboarding/components/StepContractAndMove'

const TOTAL_STEPS = 3

export function OnboardingPage() {
  const navigate = useNavigate()
  const { step, setStep, reset } = useOnboardingStore()
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    reset()
  }, [reset])

  useEffect(() => {
    titleRef.current?.focus()
  }, [step])

  function handleBack() {
    if (step === 1) {
      navigate(ROUTES.LANDING)
    } else {
      setStep(step - 1)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral">
      {/* 헤더 */}
      <header className="px-4 pt-5 pb-3">
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleBack}
            className="-ml-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-secondary/5"
            aria-label="이전 단계로 돌아가기"
          >
            <ChevronLeft className="h-9 w-9 text-secondary/80" />
          </button>
        </div>
        <div className="mt-8 px-1">
          <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
        </div>
      </header>

      {/* 스텝 콘텐츠 */}
      {step === 1 && <StepMovingDate titleRef={titleRef} />}
      {step === 2 && <StepHousingType titleRef={titleRef} />}
      {step === 3 && <StepContractAndMove titleRef={titleRef} />}
    </div>
  )
}
