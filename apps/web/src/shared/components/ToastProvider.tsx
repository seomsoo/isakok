import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Toast, type ToastVariant } from './Toast'

interface ToastData {
  id: string
  variant: ToastVariant
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION_MS = 3000
// 퇴장 애니메이션 길이 (Toast.tsx opacity 150ms ease-in과 일치)
const TOAST_EXIT_MS = 150

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const [leaving, setLeaving] = useState(false)
  const hideTimerRef = useRef<number | null>(null)
  const removeTimerRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current)
    if (removeTimerRef.current !== null) clearTimeout(removeTimerRef.current)
    hideTimerRef.current = null
    removeTimerRef.current = null
  }, [])

  const showToast = useCallback(
    (variant: ToastVariant, message: string) => {
      clearTimers()
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `toast-${Date.now()}`
      setLeaving(false)
      setToast({ id, variant, message })
      // 표시 시간 후 퇴장 애니메이션 시작 → 애니메이션 끝나면 DOM에서 제거
      hideTimerRef.current = window.setTimeout(() => {
        setLeaving(true)
        removeTimerRef.current = window.setTimeout(() => {
          setToast(null)
          setLeaving(false)
        }, TOAST_EXIT_MS)
      }, TOAST_DURATION_MS)
    },
    [clearTimers],
  )

  useEffect(() => clearTimers, [clearTimers])

  const value: ToastContextValue = {
    success: (message) => showToast('success', message),
    error: (message) => showToast('error', message),
    info: (message) => showToast('info', message),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex justify-center px-4">
            {toast && (
              <Toast
                key={toast.id}
                variant={toast.variant}
                message={toast.message}
                leaving={leaving}
              />
            )}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
