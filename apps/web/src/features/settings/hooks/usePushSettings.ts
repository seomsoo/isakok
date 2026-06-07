import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/auth/useSession'
import { useToast } from '@/shared/components/ToastProvider'
import { getPushEnabled, setPushEnabled } from '@/services/push'
import {
  requestPushPermission,
  requestPushStatus,
  openAppSettings,
  onPushStatus,
  type PushStatus,
} from '@/push/pushBridge'

const pushEnabledKey = (userId: string | null) => ['push', 'enabled', userId] as const

/**
 * 설정 화면 푸시 토글 상태 + 동작 (12단계 §6-2).
 * 2레이어: OS 권한(네이티브 PUSH_STATUS) + 앱 토글(users.push_enabled). 둘 다 충족해야 effective.
 * - 진입 시 REQUEST_PUSH_STATUS → PUSH_STATUS 수신(permission/hasToken).
 * - ON: REQUEST_PUSH_PERMISSION(네이티브가 권한+토큰+set_push_enabled(true) 일괄) / OFF: set_push_enabled(false).
 */
export function usePushSettings() {
  const { userId } = useUserId()
  const qc = useQueryClient()
  const toast = useToast()
  const [status, setStatus] = useState<PushStatus | null>(null)

  const enabledQuery = useQuery({
    queryKey: pushEnabledKey(userId),
    queryFn: () => getPushEnabled(userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  })

  useEffect(() => {
    const cleanup = onPushStatus((s) => {
      setStatus(s)
      // 등록 성공 시 네이티브가 push_enabled를 서버에서 true로 바꾸므로 재조회로 동기화.
      qc.invalidateQueries({ queryKey: pushEnabledKey(userId) })
    })
    requestPushStatus()
    return cleanup
  }, [qc, userId])

  const pushEnabled = enabledQuery.data ?? false
  const permission = status?.permission ?? 'undetermined'
  const hasToken = status?.hasToken ?? false
  const effectivePushEnabled = permission === 'granted' && pushEnabled && hasToken

  // 토글 ON: 권한 요청은 네이티브가 처리(결과는 PUSH_STATUS로 회신). denied면 OS 설정으로 유도.
  const enable = useCallback(() => {
    if (permission === 'denied') {
      openAppSettings()
      return
    }
    requestPushPermission()
  }, [permission])

  // 토글 OFF: 앱 토글만 끔(권한/토큰은 유지). 낙관적 반영 후 RPC.
  const disable = useCallback(async () => {
    qc.setQueryData(pushEnabledKey(userId), false)
    try {
      await setPushEnabled(false)
    } catch (err) {
      console.error('[usePushSettings] disable', err)
      toast.error('알림 설정 변경에 실패했어요. 다시 시도해주세요.')
      qc.invalidateQueries({ queryKey: pushEnabledKey(userId) })
    }
  }, [qc, userId, toast])

  return {
    permission,
    hasToken,
    pushEnabled,
    effectivePushEnabled,
    isLoading: enabledQuery.isPending,
    isError: enabledQuery.isError,
    refetch: enabledQuery.refetch,
    enable,
    disable,
    openSettings: openAppSettings,
  }
}
