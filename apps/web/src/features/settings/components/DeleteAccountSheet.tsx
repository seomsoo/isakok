import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ChevronLeft } from 'lucide-react'
import { isNativeWebView, sendToNative } from '@shared/utils/nativeBridge'
import type { BridgeMessage, NativeToWebMessage } from '@shared/types/bridge'
import { Button } from '@/shared/components/Button'
import { PageHeader } from '@/shared/components/PageHeader'
import { useToast } from '@/shared/components/ToastProvider'

interface DeleteAccountSheetProps {
  onClose: () => void
}

type Step = 'info' | 'confirm' | 'pending'

const PENDING_TIMEOUT_MS = 15_000
const TITLE_ID = 'delete-account-title'

export function DeleteAccountSheet({ onClose }: DeleteAccountSheetProps) {
  const [step, setStep] = useState<Step>('info')
  const [agreed, setAgreed] = useState(false)
  const toast = useToast()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && step !== 'pending') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, onClose])

  // step 전환 시 새 heading으로 포커스 이동 — SR가 새 섹션을 announce.
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  // pending 중 결과 메시지가 도달하지 않으면 사용자가 영구 잠김 → timeout으로 복귀.
  useEffect(() => {
    if (step !== 'pending') return
    const timer = setTimeout(() => {
      toast.error('응답이 없어요. 잠시 후 다시 시도해주세요.')
      setStep('info')
    }, PENDING_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [step, toast])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      let wrapped: BridgeMessage<NativeToWebMessage>
      try {
        wrapped = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (!wrapped || wrapped.version !== 1 || !wrapped.data?.type) return
      if (wrapped.data.type !== 'ACCOUNT_DELETE_RESULT') return

      const { ok, stage } = wrapped.data.payload
      if (ok) {
        toast.success('계정이 삭제되었어요.')
        onClose()
      } else if (stage === 'auth-expired') {
        toast.info('이미 삭제된 계정이에요.')
        onClose()
      } else if (stage === 'network') {
        toast.error('네트워크 오류가 발생했어요. 다시 시도해주세요.')
        setStep('info')
      } else {
        toast.error('계정 삭제 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.')
        setStep('info')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [toast, onClose])

  function handleSubmit() {
    if (!isNativeWebView()) {
      toast.error('앱에서만 사용 가능한 기능이에요.')
      return
    }
    setStep('pending')
    sendToNative({ type: 'REQUEST_DELETE_ACCOUNT' })
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-neutral"
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
    >
      <PageHeader
        title="계정 삭제"
        left={
          <button
            type="button"
            onClick={onClose}
            disabled={step === 'pending'}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-secondary disabled:opacity-40"
            aria-label="뒤로가기"
          >
            <ChevronLeft size={24} />
          </button>
        }
      />

      {step === 'info' && (
        <div className="flex flex-1 flex-col px-5 pb-10 pt-2">
          <section className="rounded-2xl bg-surface p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-critical" />
              <div>
                <h2
                  id={TITLE_ID}
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-body font-semibold text-secondary outline-none"
                >
                  삭제하면 되돌릴 수 없어요.
                </h2>
                <p className="mt-1 text-body-sm text-muted">
                  계정을 삭제하면 아래 데이터가 모두 즉시 사라지고 복구할 수 없습니다.
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-body-sm text-secondary">
              <li>• 이사 정보와 체크리스트 진행 상태</li>
              <li>• 집 상태 사진과 메모 (Storage 원본 포함)</li>
              <li>• 소셜 계정 연결 정보</li>
              <li>• 맞춤 가이드 이용 기록</li>
            </ul>
            <p className="mt-4 text-body-sm text-muted">
              소셜 계정의 앱 연결 해제도 함께 시도하지만, 실패 시 해당 서비스 설정에서 직접 끊으실
              수 있어요.
            </p>
          </section>

          <div className="mt-6 flex items-start gap-3 px-1 text-body-sm text-secondary">
            <input
              id="delete-agree"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-critical"
            />
            <label htmlFor="delete-agree">위 내용을 모두 확인했고, 계정 삭제에 동의합니다.</label>
          </div>

          <div className="mt-auto pt-6">
            <Button
              variant="danger"
              size="lg"
              disabled={!agreed}
              onClick={() => setStep('confirm')}
            >
              계정 삭제로 진행하기
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="flex flex-1 flex-col px-5 pb-10 pt-2">
          <section className="rounded-2xl bg-critical/10 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-critical" />
              <div>
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-body font-semibold text-critical outline-none"
                >
                  정말 삭제하시겠어요?
                </h2>
                <p className="mt-1 text-body-sm text-secondary">
                  이 작업은 되돌릴 수 없어요. 계속하시면 모든 데이터가 즉시 삭제됩니다.
                </p>
              </div>
            </div>
          </section>

          <div className="mt-auto flex flex-col gap-3 pt-6">
            <Button variant="danger" size="lg" onClick={handleSubmit}>
              네, 삭제할게요
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setStep('info')}>
              취소
            </Button>
          </div>
        </div>
      )}

      {step === 'pending' && (
        <div
          className="flex flex-1 flex-col items-center justify-center px-5"
          role="status"
          aria-live="polite"
        >
          <Button variant="danger" size="lg" isLoading>
            삭제 중
          </Button>
          <p className="mt-4 text-body-sm text-muted">계정과 데이터를 삭제하고 있어요...</p>
        </div>
      )}
    </div>
  )
}
