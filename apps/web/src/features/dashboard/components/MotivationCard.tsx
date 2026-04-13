import { CRITICAL_ENCOURAGEMENT, type UrgencyMode } from '@moving/shared'

interface MotivationCardProps {
  completed: number
  total: number
  mode: UrgencyMode
}

function getMessage(completed: number, total: number): string {
  if (total === 0) return '체크리스트를 준비하고 있어요'
  const percentage = Math.round((completed / total) * 100)
  const remaining = total - completed

  if (percentage === 100) return '모든 할 일을 완료했어요!'
  if (percentage >= 81) return `마지막 ${remaining}개만 남았어요!`
  if (percentage >= 51) return '절반 넘었어요! 거의 다 왔어요'

  const halfRemaining = Math.ceil(total / 2) - completed
  if (percentage >= 31) return `${halfRemaining}개만 완료하면 절반 달성!`
  if (percentage >= 1) return '좋은 시작이에요! 계속 가볼까요?'
  return '첫 번째 할 일을 완료해볼까요?'
}

function getEmoji(completed: number, total: number): string {
  if (total === 0) return ''
  const percentage = Math.round((completed / total) * 100)
  if (percentage === 100) return '🎉'
  if (percentage >= 81) return '🔥'
  if (percentage >= 51) return '✨'
  if (percentage >= 1) return '💯'
  return '👋'
}

export function MotivationCard({ completed, total, mode }: MotivationCardProps) {
  if (mode === 'critical') {
    return (
      <div className="mx-2 mt-3 rounded-2xl px-4">
        <p className="text-body-sm font-bold text-primary/75">💛 {CRITICAL_ENCOURAGEMENT}</p>
      </div>
    )
  }

  return (
    <div className="mx-2 mt-3 rounded-2xl px-4">
      <p className="text-body-sm font-bold text-primary/75">
        {getMessage(completed, total)}
        {getEmoji(completed, total)}
      </p>
    </div>
  )
}
