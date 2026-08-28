import { sendToNative, ROUTES, SUPABASE_STORAGE_KEY } from '@moving/shared'
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

/**
 * 로그아웃 후 리로드 목적지. 네이티브는 탭마다 WebView가 하나씩이라, 전부 '/'로 보내면 백그라운드 탭(전체·집기록)이
 * 홈 진입 화면에 고착돼 탭을 두 번 눌러야 복구된다 — 각 WebView는 자기 탭 루트로 돌아간다.
 */
function logoutDestination(pathname: string, search: string): string {
  const from = new URLSearchParams(search).get('from')
  if (pathname.startsWith(ROUTES.TIMELINE) || from === 'timeline') return ROUTES.TIMELINE
  if (pathname.startsWith(ROUTES.PHOTOS)) return ROUTES.PHOTOS
  return ROUTES.LANDING
}

export function setupWebSessionListener() {
  if (attached) return
  attached = true

  // 네이티브에선 세션을 브릿지로만 받는다(persistSession=false). 예전 빌드가 브라우저 방식으로 남긴 세션이 있으면 제거 —
  // 우리 storageKey(SUPABASE_STORAGE_KEY)와 supabase-js 기본 키(sb-*-auth-token) 둘 다.
  try {
    Object.keys(localStorage)
      .filter(
        (k) => k === SUPABASE_STORAGE_KEY || (k.startsWith('sb-') && k.endsWith('-auth-token')),
      )
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* best-effort */
  }

  // supabase-js는 autoRefreshToken=false여도 만료 90초 전이면 쿼리 경로(getSession)에서 스스로 refresh한다.
  // 그러면 refresh_token이 회전되는데, 네이티브가 낡은(이미 소모된) 토큰을 들고 있다가 다음 콜드스타트에서
  // invalid_grant → 로그아웃되는 걸 막기 위해 회전된 토큰을 네이티브 정본에 되돌려준다(ADR-110).
  // AUTH_SESSION으로 받은 setSession은 SIGNED_IN 이벤트라 여기 걸리지 않음(핑퐁 없음).
  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== 'TOKEN_REFRESHED' || !session) return
    sendToNative({
      type: 'SESSION_ROTATED',
      payload: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at ?? 0,
        user_id: session.user.id,
      },
    })
  })

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
      window.location.replace(logoutDestination(window.location.pathname, window.location.search))
    }
  })
}
