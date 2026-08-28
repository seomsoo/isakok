import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { getFreshSession } from '../auth/sessionLifecycle'
import { registerDeviceToken, normalizePermission } from './registerPush'
import type { PushStatusPayload } from './registerPush'

/**
 * 현재 푸시 상태 조회 (12단계 §5, REQUEST_PUSH_STATUS).
 * 권한은 요청하지 않고 조회만 한다. granted면 토큰을 idempotent 재등록해 hasToken(서버 등록 성공)을
 * 확인한다(토큰 회전 self-heal). push_enabled는 건드리지 않음 — 설정 진입이 토글을 켜면 안 되므로.
 */
export async function getPushStatus(): Promise<PushStatusPayload> {
  if (!Device.isDevice) return { permission: 'undetermined', hasToken: false }

  const { status } = await Notifications.getPermissionsAsync()
  const permission = normalizePermission(status)
  if (permission !== 'granted') return { permission, hasToken: false }

  const session = await getFreshSession()
  if (!session) return { permission: 'granted', hasToken: false }

  const hasToken = await registerDeviceToken(session)
  return { permission: 'granted', hasToken }
}
