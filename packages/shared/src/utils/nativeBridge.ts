import type { WebToNativeMessage, NativeToWebMessage, BridgeMessage } from '../types/bridge'

/**
 * 네이티브 환경인지 판별
 * injectedJavaScriptBeforeContentLoaded로 __IS_NATIVE_WEBVIEW__가 먼저 설정되므로
 * 첫 렌더에서도 정확하게 감지
 */
export function isNativeWebView(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.__IS_NATIVE_WEBVIEW__ === true || window.ReactNativeWebView !== undefined)
  )
}

/**
 * 웹 → 네이티브 메시지 전송
 * 네이티브 환경이 아니면 console.log로 폴백 (개발 중 웹 브라우저)
 */
export function sendToNative(message: WebToNativeMessage): void {
  const wrapped: BridgeMessage<WebToNativeMessage> = {
    version: 1,
    timestamp: Date.now(),
    data: message,
  }

  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(wrapped))
  } else {
    console.log('[NativeBridge] (dev fallback)', wrapped)
  }
}

/**
 * 햅틱(진동) 세기/종류. bridge.ts의 REQUEST_HAPTIC payload와 항상 동기화됨
 */
type HapticStyle = Extract<WebToNativeMessage, { type: 'REQUEST_HAPTIC' }>['payload']['style']

/**
 * 네이티브 햅틱(진동) 피드백 요청
 * 네이티브 셸이 expo-haptics로 처리. 웹 브라우저에서는 sendToNative가 console.log로 폴백하므로
 * 별도 가드 없이 호출해도 안전하게 무시됨.
 * @param style - light: 선택·토글 / medium: 일반 / heavy: 파괴적 확정 / success: 완료 / error: 실패
 */
export function requestHaptic(style: HapticStyle): void {
  sendToNative({ type: 'REQUEST_HAPTIC', payload: { style } })
}

/**
 * 네이티브 → 웹 메시지 리스너 등록
 * @returns cleanup 함수
 */
export function onNativeMessage(handler: (message: NativeToWebMessage) => void): () => void {
  function listener(event: MessageEvent) {
    try {
      const parsed: BridgeMessage<NativeToWebMessage> = JSON.parse(event.data)
      if (parsed.version === 1) {
        handler(parsed.data)
      }
    } catch {
      // 브릿지 메시지가 아닌 다른 postMessage 무시
    }
  }

  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}
