import { useState } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'photos.banner.dismissed'

interface PhotoInfoBannerProps {
  photoType: 'move_in' | 'move_out'
}

export function PhotoInfoBanner({ photoType }: PhotoInfoBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  })

  if (dismissed) return null

  function handleDismiss() {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="mx-5 flex items-start gap-3 rounded-2xl bg-tertiary/60 px-4 py-4">
      <div className="flex-1">
        <p className="text-[15px] font-bold leading-snug text-secondary">
          {photoType === 'move_in'
            ? '사진을 남겨두면 보증금 분쟁 시'
            : '퇴실 전 집 상태를 기록해두면'}
        </p>
        <p className="text-[15px] font-bold leading-snug text-primary">
          {photoType === 'move_in'
            ? '핵심 증거가 돼요'
            : '분쟁을 예방할 수 있어요'}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="안내 닫기"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-muted"
      >
        <X size={15} />
      </button>
    </div>
  )
}
