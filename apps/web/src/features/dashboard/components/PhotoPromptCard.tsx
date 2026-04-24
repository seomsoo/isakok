import { Camera } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ROUTES, type UrgencyMode } from '@moving/shared'

interface PhotoPromptCardProps {
  daysRemaining: number
  mode: UrgencyMode
}

export function PhotoPromptCard({ daysRemaining, mode }: PhotoPromptCardProps) {
  const navigate = useNavigate()
  if (mode === 'critical') return null
  const title =
    daysRemaining > 0
      ? '퇴실 전 집 상태를 기록하세요'
      : '입주 사진을 찍어두면 나중에 보증금을 지켜줘요'

  const subtitle =
    daysRemaining > 0 ? '작은 흠집도 꼼꼼하게 기록해두세요.' : '사소한 흠집도 꼼꼼하게 기록하세요.'

  function handlePress() {
    navigate(ROUTES.PHOTOS)
  }

  return (
    <section className="mx-5 mt-6">
      <div className="rounded-2xl bg-surface p-5 ">
        <p className="text-body font-medium text-secondary">{title}</p>
        <p className="mt-1 text-body-sm text-muted">{subtitle}</p>
        <button
          type="button"
          onClick={handlePress}
          className="mt-4 flex items-center gap-1.5 text-body-sm font-medium text-primary"
        >
          <Camera size={16} />
          기록 시작하기 →
        </button>
      </div>
    </section>
  )
}
