import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from '@/auth/useSession'
import { getPushPromptState, markPushPromptSeen } from '@/services/push'
import { pushKeys } from '@/push/queryKeys'

/**
 * soft-ask 노출 여부 + "나중에/허용" 기록 (12단계 §6-1)
 * 노출 조건: push_prompt_seen_at IS NULL AND push_enabled=false (세션 내 dismiss 포함)
 */
export function usePushPrompt() {
  const { userId } = useUserId()
  const qc = useQueryClient()
  const [dismissed, setDismissed] = useState(false)

  const { data } = useQuery({
    queryKey: pushKeys.prompt(userId),
    queryFn: () => getPushPromptState(userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  })

  const visible = !!data && !dismissed && !data.promptSeen && !data.pushEnabled

  const recordSeen = useCallback(() => {
    setDismissed(true)
    markPushPromptSeen()
      .then(() => qc.invalidateQueries({ queryKey: pushKeys.prompt(userId) }))
      .catch((err) => console.error('[usePushPrompt] markSeen', err))
  }, [qc, userId])

  return { visible, recordSeen }
}
