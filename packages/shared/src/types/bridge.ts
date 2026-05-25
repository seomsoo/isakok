/**
 * 웹 → 네이티브 메시지
 * WebView의 window.ReactNativeWebView.postMessage()로 전송
 */
export type WebToNativeMessage =
  | { type: 'OPEN_CAMERA'; payload: { room: string; photoType: 'move_in' | 'move_out' } }
  | {
      type: 'REQUEST_LOGIN'
      payload?: {
        source: 'onboarding_top' | 'photo_gate' | 'completion_cta' | 'ai_regenerate' | 'settings'
      }
    }
  | { type: 'REQUEST_LOGOUT' }
  | { type: 'REQUEST_SESSION_REFRESH' }
  | { type: 'OPEN_EXTERNAL_LINK'; payload: { url: string } }
  | { type: 'SHARE_REPORT'; payload: { url: string } }
  | { type: 'WEB_READY' }
  | { type: 'ROUTE_CHANGE'; payload: { path: string } }
  | { type: 'NAVIGATE_TAB'; payload: { tab: 'home' | 'timeline' | 'photos' } }
  | { type: 'SET_TAB_BAR'; payload: { visible: boolean } }
  | { type: 'SET_SAFE_AREA_STYLE'; payload: { top: 'default' | 'black' } }

/**
 * 네이티브 → 웹 메시지
 * WebView의 injectJavaScript()로 전송
 */
export type NativeToWebMessage =
  | {
      type: 'AUTH_SESSION'
      payload: {
        access_token: string
        refresh_token: string
        expires_at: number
        user_id: string
        is_anonymous: boolean
      }
    }
  | { type: 'AUTH_LOGOUT' }
  | {
      type: 'PHOTO_TAKEN'
      payload: { uri: string; exif: Record<string, unknown>; hash: string }
    }
  | { type: 'NETWORK_STATUS'; payload: { online: boolean } }
  | { type: 'PLATFORM_INFO'; payload: { os: 'ios' | 'android'; isNative: true } }

/**
 * 브릿지 메시지 공통 래퍼
 */
export interface BridgeMessage<T = WebToNativeMessage | NativeToWebMessage> {
  version: 1
  timestamp: number
  data: T
}

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
    __IS_NATIVE_WEBVIEW__?: boolean
  }
}
