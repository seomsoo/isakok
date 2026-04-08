import { Truck, Home } from 'lucide-react'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100
  const isComplete = currentStep >= totalSteps

  return (
    <div
      className="relative h-8"
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`${totalSteps}단계 중 ${currentStep}단계`}
    >
      {/* 트랙 (아이콘 크기만큼 양쪽 여백) */}
      <div className="absolute top-1/2 right-3.5 left-3.5 h-1 -translate-y-1/2 rounded-full bg-border">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 집 아이콘 (트랙 끝에 고정) */}
      <div
        className={`absolute right-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-300 ${
          isComplete ? 'scale-0 opacity-0' : 'scale-100 bg-tertiary text-primary opacity-100'
        }`}
      >
        <Home size={14} strokeWidth={2} />
      </div>

      {/* 화물차 아이콘 (진행 위치) */}
      <div
        className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
        style={{ left: `calc(${progress}% - ${progress / 100} * 1.75rem)` }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-colors duration-300 bg-primary text-white">
          {isComplete ? <Home size={14} strokeWidth={2} /> : <Truck size={14} strokeWidth={2} />}
        </div>
      </div>
    </div>
  )
}
