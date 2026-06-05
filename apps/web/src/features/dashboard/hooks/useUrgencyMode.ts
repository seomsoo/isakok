import { useEffect } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import {
  getUrgencyMode,
  parseLocalDate,
  MODE_TRANSITION_MESSAGE,
  type UrgencyMode,
} from '@moving/shared'
import { useModeStore } from '@/stores/modeStore'
import { captureEvent, ANALYTICS_EVENTS } from '@/observability/events'

export interface UseUrgencyModeResult {
  mode: UrgencyMode
  daysUntilMove: number
  today: string
  isTransitioned: boolean
  transitionMessage: string | null
}

/**
 * 현재 모드 판별 + 이전 모드와 비교해 전환 여부/안내 메시지 반환
 */
export function useUrgencyMode(movingDate: string): UseUrgencyModeResult {
  const today = format(new Date(), 'yyyy-MM-dd')
  const daysUntilMove = movingDate
    ? differenceInCalendarDays(parseLocalDate(movingDate), parseLocalDate(today))
    : 0
  const mode = getUrgencyMode(daysUntilMove)

  const { previousMode, setPreviousMode, transitionDismissed } = useModeStore()

  const isTransitioned = previousMode !== null && previousMode !== mode && !transitionDismissed
  const transitionKey = previousMode && previousMode !== mode ? `${previousMode}→${mode}` : null
  const transitionMessage = transitionKey ? (MODE_TRANSITION_MESSAGE[transitionKey] ?? null) : null

  useEffect(() => {
    if (previousMode !== mode) {
      // 초기 설정(null→mode)은 전환 아님. 실제 모드 전환만 기록(§2-2)
      if (previousMode !== null) captureEvent(ANALYTICS_EVENTS.RESCHEDULE_MODE_CHANGED, { mode })
      setPreviousMode(mode)
    }
  }, [mode, previousMode, setPreviousMode])

  return { mode, daysUntilMove, today, isTransitioned, transitionMessage }
}
