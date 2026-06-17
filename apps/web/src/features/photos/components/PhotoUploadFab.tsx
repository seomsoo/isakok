import { useState } from 'react'
import { Camera, Image as ImageIcon, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface PhotoUploadFabProps {
  /** 촬영/갤러리 선택 시 호출 (회원). 네이티브 미디어 피커를 연다 (ADR-079) */
  onPick: (kind: 'camera' | 'gallery') => void
  disabled?: boolean
  /** 익명 사용자 여부. true면 파일 선택 전에 로그인 게이트 발동 (ADR-074) */
  isAnonymous?: boolean
  /** 익명 사용자가 업로드를 시도할 때 호출 (로그인 시트 요청) */
  onRequestLogin?: () => void
}

export function PhotoUploadFab({
  onPick,
  disabled,
  isAnonymous,
  onRequestLogin,
}: PhotoUploadFabProps) {
  const [isOpen, setIsOpen] = useState(false)

  // 사진 저장 게이트(ADR-074): 익명이면 파일 선택 전에 로그인 요청, 회원이면 네이티브 피커
  function handlePick(kind: 'camera' | 'gallery') {
    setIsOpen(false)
    if (isAnonymous) {
      onRequestLogin?.()
      return
    }
    onPick(kind)
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          role="button"
          tabIndex={0}
          aria-label="메뉴 닫기"
          onClick={() => setIsOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setIsOpen(false)
          }}
        />
      )}

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+20px)] right-5 z-40 flex flex-col items-end gap-3">
        {isOpen && (
          <div className="animate-fade-in flex flex-col items-end gap-3">
            <button
              type="button"
              onClick={() => handlePick('gallery')}
              className="flex h-12 items-center gap-2 rounded-2xl bg-white px-4 shadow-lg"
            >
              <ImageIcon size={18} className="text-secondary" />
              <span className="text-[14px] font-medium text-secondary">갤러리</span>
            </button>
            <button
              type="button"
              onClick={() => handlePick('camera')}
              className="flex h-12 items-center gap-2 rounded-2xl bg-white px-4 shadow-lg"
            >
              <Camera size={18} className="text-secondary" />
              <span className="text-[14px] font-medium text-secondary">촬영</span>
            </button>
          </div>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? '닫기' : '사진 추가'}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform duration-200 motion-reduce:transition-none',
            isOpen ? 'rotate-45 bg-secondary text-white' : 'bg-primary text-white',
            'disabled:opacity-40',
          )}
        >
          {isOpen ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>
    </>
  )
}
