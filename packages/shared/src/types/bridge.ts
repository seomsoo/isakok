/**
 * 웹 → 네이티브 메시지
 * WebView의 window.ReactNativeWebView.postMessage()로 전송
 */
export type WebToNativeMessage =
  | {
      // 네이티브 미디어 피커 요청 (ADR-079). 카메라/갤러리 모두 expo-image-picker.
      // 네이티브가 Storage 경로(`{userId}/{moveId}/{room}_{ts}`) 생성에 필요한 정보 포함.
      type: 'OPEN_MEDIA_PICKER'
      payload: {
        kind: 'camera' | 'gallery'
        multi: boolean
        moveId: string
        room: string
        photoType: 'move_in' | 'move_out'
        maxSelect: number
      }
    }
  | {
      type: 'REQUEST_LOGIN'
      payload?: {
        source: 'onboarding_top' | 'photo_gate' | 'completion_cta' | 'ai_regenerate' | 'settings'
      }
    }
  | { type: 'REQUEST_LOGOUT' }
  | { type: 'REQUEST_DELETE_ACCOUNT' }
  | { type: 'REQUEST_SESSION_REFRESH' }
  | { type: 'OPEN_EXTERNAL_LINK'; payload: { url: string } }
  | { type: 'SHARE_REPORT'; payload: { url: string } }
  | { type: 'WEB_READY' }
  | { type: 'ROUTE_CHANGE'; payload: { path: string } }
  | { type: 'NAVIGATE_TAB'; payload: { tab: 'home' | 'timeline' | 'photos' } }
  | { type: 'SET_TAB_BAR'; payload: { visible: boolean } }
  | { type: 'SET_SAFE_AREA_STYLE'; payload: { top: 'default' | 'black' } }
  | {
      type: 'REQUEST_HAPTIC'
      payload: { style: 'light' | 'medium' | 'heavy' | 'success' | 'error' }
    }

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
  | { type: 'ACCOUNT_DELETE_RESULT'; payload: { ok: boolean; stage?: string } }
  | { type: 'NAVIGATE_TO'; payload: { path: string; replace?: boolean } }
  | {
      // 네이티브가 Storage 직접 업로드 완료 후 메타데이터만 전달 (ADR-079). 파일은 WebView 미통과.
      // 웹은 이 메타로 property_photos INSERT (Storage 부분 없음). user.id 일치 검증 후 INSERT.
      type: 'MEDIA_UPLOADED'
      payload: {
        moveId: string
        room: string
        photoType: 'move_in' | 'move_out'
        items: { storage_path: string; taken_at: string | null; hash: string }[]
        failed: number
      }
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
