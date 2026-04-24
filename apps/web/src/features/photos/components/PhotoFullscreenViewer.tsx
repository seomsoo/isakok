import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import type { PropertyPhoto } from '@/services/photos'

interface PhotoFullscreenViewerProps {
  photo: PropertyPhoto
  signedUrl?: string
  onClose: () => void
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function PhotoFullscreenViewer({ photo, signedUrl, onClose }: PhotoFullscreenViewerProps) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const lastDistRef = useRef(0)
  const lastCenterRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function getDistance(touches: React.TouchList): number {
    const t0 = touches.item(0)
    const t1 = touches.item(1)
    if (!t0 || !t1) return 0
    const dx = t1.clientX - t0.clientX
    const dy = t1.clientY - t0.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function getCenter(touches: React.TouchList): { x: number; y: number } {
    const t0 = touches.item(0)
    const t1 = touches.item(1)
    if (!t0) return { x: 0, y: 0 }
    if (!t1) return { x: t0.clientX, y: t0.clientY }
    return {
      x: (t0.clientX + t1.clientX) / 2,
      y: (t0.clientY + t1.clientY) / 2,
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      lastDistRef.current = getDistance(e.touches)
      lastCenterRef.current = getCenter(e.touches)
    } else if (e.touches.length === 1 && scale > 1) {
      const t = e.touches.item(0)
      if (!t) return
      isDraggingRef.current = true
      lastCenterRef.current = { x: t.clientX, y: t.clientY }
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dist = getDistance(e.touches)
      if (lastDistRef.current > 0) {
        const newScale = Math.min(Math.max(scale * (dist / lastDistRef.current), 1), 4)
        setScale(newScale)
        if (newScale === 1) setTranslate({ x: 0, y: 0 })
      }
      lastDistRef.current = dist
    } else if (e.touches.length === 1 && isDraggingRef.current && scale > 1) {
      const t = e.touches.item(0)
      if (!t) return
      const dx = t.clientX - lastCenterRef.current.x
      const dy = t.clientY - lastCenterRef.current.y
      setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
      lastCenterRef.current = { x: t.clientX, y: t.clientY }
    }
  }

  function handleTouchEnd() {
    lastDistRef.current = 0
    isDraggingRef.current = false
  }

  function handleDoubleTap() {
    if (scale > 1) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    } else {
      setScale(2)
    }
  }

  const dateIso = photo.taken_at ?? photo.uploaded_at ?? photo.created_at

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 확대"
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <div className="relative z-10 flex shrink-0 items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+8px)]">
        <div className="w-10" />
        {dateIso ? (
          <span className="text-[15px] font-medium text-white/70">{formatDateTime(dateIso)}</span>
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center overflow-hidden -mt-30">
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleTap}
        >
          {signedUrl ? (
            <img
              src={signedUrl}
              alt=""
              className="max-h-[70dvh] max-w-full object-contain"
              style={{
                transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                transition: scale === 1 ? 'transform 0.2s ease-out' : undefined,
              }}
              draggable={false}
            />
          ) : (
            <Loader2 size={32} className="animate-spin text-white/60" />
          )}
        </div>

        {photo.memo && photo.memo.trim() && (
          <div className="mt-4 w-full px-5">
            <p className="text-[14px] leading-relaxed text-white/80">{photo.memo}</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
