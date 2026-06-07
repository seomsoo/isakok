import { sendToNative, onNativeMessage } from '@moving/shared'

// 푸시 권한/토큰은 네이티브 전용이라 웹은 브릿지로 위임만 한다(12단계 §6-3).

export interface PushStatus {
  permission: 'granted' | 'denied' | 'undetermined'
  hasToken: boolean
}

/** soft-ask "받기" / 설정 토글 ON → 네이티브 권한 요청 + 토큰 등록 + set_push_enabled(true) 일괄. */
export function requestPushPermission(): void {
  sendToNative({ type: 'REQUEST_PUSH_PERMISSION' })
}

/** 설정 진입 시 현재 권한/토큰 상태 요청 (→ PUSH_STATUS 수신). */
export function requestPushStatus(): void {
  sendToNative({ type: 'REQUEST_PUSH_STATUS' })
}

/** OS 권한 denied 시 기기 앱 설정 열기 (네이티브 Linking.openSettings). */
export function openAppSettings(): void {
  sendToNative({ type: 'OPEN_APP_SETTINGS' })
}

/** PUSH_STATUS 수신 구독. 반환값은 cleanup. */
export function onPushStatus(handler: (status: PushStatus) => void): () => void {
  return onNativeMessage((message) => {
    if (message.type === 'PUSH_STATUS') handler(message.payload)
  })
}
