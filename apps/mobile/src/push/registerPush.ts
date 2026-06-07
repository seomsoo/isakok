import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { getCurrentSession } from '../auth/sessionState'
import { createAuthedClient } from '../auth/supabaseNative'

export interface PushStatusPayload {
  permission: 'granted' | 'denied' | 'undetermined'
  hasToken: boolean
}

/** expo-notifications의 PermissionStatus(enum)를 브릿지 리터럴 유니온으로 정규화. */
function normalizePermission(
  status: Notifications.PermissionStatus,
): PushStatusPayload['permission'] {
  if (status === 'granted') return 'granted'
  if (status === 'denied') return 'denied'
  return 'undetermined'
}

function getProjectId(): string | null {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    null
  )
}

/**
 * 토큰 발급 + register-push-token Edge Function 등록. 서버 등록 성공 여부를 반환.
 * supabaseNative는 세션이 없어 anon으로 호출되므로(401), Storage 업로드(ADR-079)와 동일하게
 * 현재 세션 access_token으로 인증한 클라이언트로 호출한다. push_enabled는 건드리지 않음.
 */
export async function registerDeviceToken(session: Session): Promise<boolean> {
  const projectId = getProjectId()
  if (!projectId) {
    console.error('[registerPush] EAS projectId missing')
    return false
  }
  let token: string
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  } catch (err) {
    console.error('[registerPush] getExpoPushTokenAsync failed', err)
    return false
  }
  const platform = Platform.OS === 'ios' ? 'ios' : 'android'
  const client = createAuthedClient(session.access_token)
  const { error } = await client.functions.invoke('register-push-token', {
    body: { token, platform },
  })
  if (error) {
    console.error('[registerPush] server register failed', error)
    return false
  }
  return true
}

/**
 * soft-ask "받기" / 설정 토글 ON 흐름 (12단계 §5-1).
 * OS 권한 → 허용 시 토큰 발급·서버 등록 → 성공 시 set_push_enabled(true) → 상태 회신.
 * hasToken = 서버 등록 성공 여부(리뷰 #13).
 */
export async function registerPush(): Promise<PushStatusPayload> {
  if (!Device.isDevice) return { permission: 'undetermined', hasToken: false }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let status = existing
  if (existing !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status
  }
  const permission = normalizePermission(status)
  if (permission !== 'granted') return { permission, hasToken: false }

  const session = getCurrentSession()
  if (!session) {
    console.error('[registerPush] no session — cannot register token')
    return { permission: 'granted', hasToken: false }
  }

  const ok = await registerDeviceToken(session)
  if (!ok) return { permission: 'granted', hasToken: false }

  // 등록 성공 → 앱 토글 ON (users UPDATE 차단 우회 RPC, 00026)
  const client = createAuthedClient(session.access_token)
  const { error } = await client.rpc('set_push_enabled', { p_enabled: true })
  if (error) console.error('[registerPush] set_push_enabled failed', error)

  return { permission: 'granted', hasToken: true }
}

/**
 * 로그아웃 시 이 계정의 푸시 토큰/토글 정리 (보안). 세션 clear 이전(옛 user JWT 유효 시) 호출해야 한다.
 * 토큰 행 삭제(delete_my_push_tokens) + set_push_enabled(false)로 발송 대상에서 제외 → 같은 기기를
 * 쓰는 새 익명 유저에게 옛 user 알림이 가지 않게 한다. 둘 다 best-effort(실패해도 로그아웃은 진행).
 */
export async function unregisterPush(session: Session): Promise<void> {
  const client = createAuthedClient(session.access_token)
  const { error: delErr } = await client.rpc('delete_my_push_tokens')
  if (delErr) console.error('[unregisterPush] delete tokens failed', delErr)
  const { error: setErr } = await client.rpc('set_push_enabled', { p_enabled: false })
  if (setErr) console.error('[unregisterPush] set_push_enabled failed', setErr)
}
