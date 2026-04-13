interface CircularProgressProps {
  completed: number
  total: number
  size?: number
  strokeWidth?: number
  className?: string
  label?: string
  ariaLabel?: string
}

export function CircularProgress({
  completed,
  total,
  size = 64,
  strokeWidth = 4,
  className,
  label = '완료',
  ariaLabel,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = total > 0 ? completed / total : 0
  const offset = circumference * (1 - percentage)

  return (
    <div className={className} role="img" aria-label={ariaLabel ?? `진행률 ${completed}/${total} 완료`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 배경 트랙 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="white"
          strokeOpacity={0.3}
          strokeWidth={strokeWidth}
        />
        {/* 채움 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {/* 중앙 텍스트 */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-body font-bold text-white leading-none">
          {completed}/{total}
        </span>
        <span className="text-caption text-white/70 leading-none mt-0.5">{label}</span>
      </div>
    </div>
  )
}
