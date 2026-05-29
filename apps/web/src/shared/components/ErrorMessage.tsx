import { AlertCircle } from 'lucide-react'

interface ErrorMessageProps {
  /** 표시할 안내 문구 (기본: 일반 조회 실패 메시지) */
  message?: string
  /** 재시도 버튼 클릭 시 호출 (보통 TanStack Query refetch). 없으면 버튼 숨김 */
  onRetry?: () => void
}

/**
 * 비동기 조회 실패(error) 상태 공통 폴백. 빈 상태(EmptyState)와 구분해 "데이터 없음"으로 위장되지 않게 한다.
 * role="alert"로 스크린리더에 즉시 전달.
 */
export function ErrorMessage({ message = '정보를 불러오지 못했어요', onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center"
    >
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
        <AlertCircle size={24} strokeWidth={1.5} className="text-muted" />
      </div>
      <p className="text-[15px] font-semibold text-secondary">{message}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">잠시 후 다시 시도해주세요</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 flex h-12 items-center rounded-xl bg-primary px-6 font-semibold text-white"
        >
          다시 시도
        </button>
      )}
    </div>
  )
}
