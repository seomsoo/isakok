import * as Notifications from 'expo-notifications'
import { sendToFocusedWebView } from '../auth/broadcast'
import { normalizePushRoute } from '@moving/shared'

// 포그라운드에서도 배너/목록/사운드 표시 (배지는 미사용). SDK 55 핸들러 필드(shouldShowBanner/List).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

// 콜드스타트(종료 상태 탭): WebView 로드 전 NAVIGATE를 보내면 유실 → 보류 후 WEB_READY에 flush
// (AUTH_SESSION lazy-mount, ADR-049와 동일 패턴).
let pendingRoute: string | null = null

/** 알림 응답(탭) 리스너 등록. 반환값은 해제 함수. route는 네이티브에서도 allowlist 정규화(1차 방어). */
export function attachResponseListener(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((res) => {
    pendingRoute = normalizePushRoute(res.notification.request.content.data?.route)
    flushPendingRoute()
  })
  return () => sub.remove()
}

/**
 * 종료 상태에서 알림 탭으로 켜진 경우 마지막 응답을 보류 라우트로 적재.
 * useLastNotificationResponse 훅이 권장 대체지만, 우리는 RN→WebView 버퍼링(WEB_READY까지 보류)이
 * 필요해 명령형 getter를 쓴다(warm 탭은 리스너, cold 탭은 이 함수로 경로 분리). deprecated지만 SDK 55 동작.
 * 처리한 응답은 clear — 다음 콜드스타트에서 stale 라우트로 재진입하지 않게.
 */
export async function handleColdStart(): Promise<void> {
  const last = await Notifications.getLastNotificationResponseAsync()
  if (last) {
    pendingRoute = normalizePushRoute(last.notification.request.content.data?.route)
    await Notifications.clearLastNotificationResponseAsync().catch(() => undefined)
  }
}

/** 보류 라우트를 WebView로 flush (WEB_READY 시 호출). 보류가 없으면 no-op. */
export function flushPendingRoute(): void {
  if (!pendingRoute) return
  // 활성(포커스) 탭 WebView에만 전달 — 전체 broadcast는 비활성 탭 라우트까지 오염시킨다(P2).
  // 활성 WebView가 아직 없으면(콜드스타트 로드 전) 보류 유지 → WEB_READY/포커스 시 재flush.
  const sent = sendToFocusedWebView({ type: 'NAVIGATE', payload: { path: pendingRoute } })
  if (sent) pendingRoute = null
}
