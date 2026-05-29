import { Camera, Image as ImageIcon } from 'lucide-react'

interface PhotoEmptyStateProps {
  tipDetail: string
  /** 촬영/갤러리 선택 시 호출 (회원). 네이티브 미디어 피커를 연다 (ADR-079) */
  onPick: (kind: 'camera' | 'gallery') => void
  /** 익명 사용자 여부. true면 파일 선택 전에 로그인 게이트 발동 (ADR-074) */
  isAnonymous?: boolean
  /** 익명 사용자가 업로드를 시도할 때 호출 (로그인 시트 요청) */
  onRequestLogin?: () => void
}

export function PhotoEmptyState({
  tipDetail,
  onPick,
  isAnonymous,
  onRequestLogin,
}: PhotoEmptyStateProps) {
  // 사진 저장 게이트(ADR-074): 익명이면 파일 선택 전에 로그인 요청, 회원이면 네이티브 피커
  function handlePick(kind: 'camera' | 'gallery') {
    if (isAnonymous) {
      onRequestLogin?.()
      return
    }
    onPick(kind)
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
        <Camera size={24} strokeWidth={1.5} className="text-muted" />
      </div>
      <p className="text-[15px] font-semibold text-secondary">아직 사진이 없어요</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {isAnonymous
          ? '입주·퇴실 사진은 보증금 분쟁의 증거가 돼요. 로그인하면 안전하게 보관할 수 있어요.'
          : tipDetail}
      </p>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => handlePick('camera')}
          className="flex h-12 items-center gap-1.5 rounded-xl bg-primary px-5 font-semibold text-white"
        >
          <Camera size={18} />
          촬영
        </button>
        <button
          type="button"
          onClick={() => handlePick('gallery')}
          className="flex h-12 items-center gap-1.5 rounded-xl border border-border bg-white px-5 font-semibold text-secondary"
        >
          <ImageIcon size={18} />
          갤러리
        </button>
      </div>
    </div>
  )
}
