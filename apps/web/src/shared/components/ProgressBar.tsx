interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  return (
    <div
      className="flex gap-2"
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`${totalSteps}단계 중 ${currentStep}단계`}
    >
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ease-out ${
            i < currentStep ? 'bg-primary' : 'bg-border'
          }`}
        />
      ))}
    </div>
  )
}
