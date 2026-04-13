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

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const showToast = useCallback((variant: ToastVariant, message: string) => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
    }
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `toast-${Date.now()}`
    setToast({ id, variant, message })
    timeoutRef.current = window.setTimeout(() => {
      setToast(null)
      timeoutRef.current = null
    }, TOAST_DURATION_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

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
            {toast && <Toast key={toast.id} variant={toast.variant} message={toast.message} />}
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
