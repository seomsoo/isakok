import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import type { BridgeMessage, NativeToWebMessage } from '@shared/types/bridge'
import { cancelBridgeAuthTimer, reportMalformedBridgeMessage } from '@/observability/bridgeMonitor'
import { setSentryUser, clearSentryUser } from '@/observability/sentry'
import { identifyAnalyticsUser, resetAnalyticsUser } from '@/observability/posthog'
import { captureEvent, ANALYTICS_EVENTS } from '@/observability/events'

let attached = false

// 익명→식별 전환(로그인 액션) 감지용. 콜드스타트 시 이미 로그인 상태(null→false)는 로그인으로 세지 않음.
let lastIsAnonymous: boolean | null = null

/**
 * 우리 BridgeMessage 래퍼를 시도하는 메시지인지 판별.
 * 확장프로그램·SDK 등의 무관한 window postMessage를 malformed로 오탐하지 않도록,
 * `version` 또는 `data` 필드를 가진 객체만 브릿지 메시지 후보로 본다(§1-3 false positive 방어).
 */
function looksLikeBridgeAttempt(raw: unknown): raw is Record<string, unknown> {
  return !!raw && typeof raw === 'object' && ('version' in raw || 'data' in raw)
}

export function setupWebSessionListener() {
  if (attached) return
  attached = true

  try {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    )
    if (key) localStorage.removeItem(key)
  } catch {
    /* best-effort */
  }

  window.addEventListener('message', async (event) => {
    let parsed: unknown
    try {
      parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    } catch {
      // 비-JSON 외부 postMessage — 우리 브릿지 아님, 무시
      return
    }

    // 브릿지처럼 보이는 메시지만 계약 검증 (foreign postMessage 오탐 방지)
    if (!looksLikeBridgeAttempt(parsed)) return
    const wrapped = parsed as Partial<BridgeMessage<NativeToWebMessage>>
    if (wrapped.version !== 1 || !wrapped.data?.type) {
      reportMalformedBridgeMessage('shape')
      return
    }

    const message = wrapped.data
    if (message.type === 'AUTH_SESSION') {
      // 브릿지 정상 동작 — 타임아웃 측정 취소 + 에러 추적 user context(id만) 설정
      cancelBridgeAuthTimer()
      setSentryUser(message.payload.user_id)
      // distinct_id = auth.uid() (익명 포함) — 퍼널 연속성(§2-3)
      identifyAnalyticsUser(message.payload.user_id)
      // 익명→식별 전환만 로그인 액션으로 기록. signup 구분은 web 불가 → native/server 후속(§2-2)
      if (lastIsAnonymous === true && message.payload.is_anonymous === false) {
        captureEvent(ANALYTICS_EVENTS.LOGIN)
      }
      lastIsAnonymous = message.payload.is_anonymous

      const { error } = await supabase.auth.setSession({
        access_token: message.payload.access_token,
        refresh_token: message.payload.refresh_token,
      })
      if (error) console.error('[webSessionListener] setSession', error)
    } else if (message.type === 'AUTH_LOGOUT') {
      clearSentryUser()
      resetAnalyticsUser()
      lastIsAnonymous = null
      await supabase.auth.signOut({ scope: 'local' })
      queryClient.clear()
      window.location.replace('/')
    }
  })
}
