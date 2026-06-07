import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isNativeWebView, PUSH_PERMISSION_COPY } from '@moving/shared'
import { useUserId } from '@/auth/useSession'
import { getPushPromptState, markPushPromptSeen } from '@/services/push'
import { requestPushPermission } from '@/push/pushBridge'
import { Button } from '@/shared/components/Button'

/**
 * soft-ask 권한 모달 (12단계 §6-1). 온보딩 직후 진입한 대시보드에서 1회 노출.
 * 노출 조건: 네이티브 WebView AND push_prompt_seen_at IS NULL AND push_enabled=false.
 * persistent 가드(push_prompt_seen_at)라 reload/재시작에도 재노출 0. "나중에"는 OS 다이얼로그를
 * 띄우지 않아(거부 박제 회피) prompt만 기록. Esc도 "나중에"와 동일 처리.
 */
export function PushPermissionSheet() {
  if (!isNativeWebView()) return null
  return <PushPermissionSheetInner />
}

function PushPermissionSheetInner() {
  const { userId } = useUserId()
  const qc = useQueryClient()
  const [dismissed, setDismissed] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['push', 'prompt', userId],
    queryFn: () => getPushPromptState(userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  })

  const visible = !!data && !dismissed && !data.promptSeen && !data.pushEnabled

  const recordSeen = useCallback(() => {
    setDismissed(true)
    markPushPromptSeen()
      .then(() => qc.invalidateQueries({ queryKey: ['push', 'prompt', userId] }))
      .catch((err) => console.error('[PushPermissionSheet] markSeen', err))
  }, [qc, userId])

  // 열릴 때 제목으로 포커스 이동 — SR가 모달을 announce, 포커스가 뒤 대시보드에 남지 않게.
  useEffect(() => {
    if (visible) headingRef.current?.focus()
  }, [visible])

  // Esc 닫기(="나중에": OS 다이얼로그 안 띄움) + Tab focus trap(포커스가 뒤 콘텐츠로 새지 않게).
  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        recordSeen()
        return
      }
      if (e.key !== 'Tab') return
      const nodes = containerRef.current?.querySelectorAll<HTMLElement>('button')
      if (!nodes || nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (!first || !last) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible, recordSeen])

  if (!visible) return null

  const onAllow = () => {
    requestPushPermission()
    recordSeen()
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-sheet-title"
    >
      <div className="w-full max-w-[430px] rounded-t-3xl bg-surface px-5 pb-8 pt-6">
        <h2
          id="push-sheet-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-h2 font-bold text-secondary outline-none"
        >
          {PUSH_PERMISSION_COPY.title}
        </h2>
        <p className="mt-3 text-body text-muted">{PUSH_PERMISSION_COPY.body}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="primary" size="lg" onClick={onAllow}>
            {PUSH_PERMISSION_COPY.allow}
          </Button>
          <Button variant="ghost" size="lg" onClick={recordSeen}>
            {PUSH_PERMISSION_COPY.later}
          </Button>
        </div>
      </div>
    </div>
  )
}
