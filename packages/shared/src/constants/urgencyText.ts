import type { UrgencyMode } from '../utils/urgencyMode'

export const GREETING_TEXT: Record<UrgencyMode, string> = {
  relaxed: '여유 있게 준비해요',
  tight: '하나씩 챙겨볼까요',
  urgent: '이사가 곧이에요!',
  critical: '이사가 코앞이에요!',
}

export const ACTION_SECTION_TITLE: Record<UrgencyMode, string> = {
  relaxed: '지금 해두면 편해요',
  tight: '먼저 챙기면 좋은 것',
  urgent: '지금 바로 해야 해요',
  critical: '꼭 해야 할 것',
}

export const PROGRESS_LABEL: Record<UrgencyMode, (completed: number, total: number) => string> = {
  relaxed: (c, t) => `${c}/${t} 완료`,
  tight: (c, t) => `${c}/${t} 완료`,
  urgent: (c, t) => `필수 ${c}/${t} 완료`,
  critical: (c, t) => `필수 ${c}/${t} 완료`,
}

export const CRITICAL_ENCOURAGEMENT = '다 못해도 괜찮아요. 필수만 챙기세요.'
export const CRITICAL_SKIPPABLE_HINT = '다 못해도 이사에 큰 문제 없어요'

export const URGENCY_GROUP_LABELS = {
  now: '지금 바로',
  thisWeek: '이번 주',
  movingDay: '이사 전날·당일',
  afterMove: '이사 후',
  canSkip: '여유 되면',
  essential: '꼭 해야 할 것',
} as const

export const MODE_TRANSITION_MESSAGE: Record<string, string> = {
  'relaxed→tight': '이사일이 가까워졌어요. 남은 할 일을 다시 배치했어요.',
  'relaxed→urgent': '이사가 곧이에요! 중요한 것부터 보여드릴게요.',
  'relaxed→critical': '이사가 코앞이에요! 꼭 해야 할 것만 모아뒀어요.',
  'tight→urgent': '이사가 곧이에요! 중요한 것부터 보여드릴게요.',
  'tight→critical': '이사가 코앞이에요! 꼭 해야 할 것만 모아뒀어요.',
  'urgent→critical': '이사가 코앞이에요! 꼭 해야 할 것만 모아뒀어요.',
}
