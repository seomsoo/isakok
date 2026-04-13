import { useEffect, useState } from 'react'
import { Check, X, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ToastVariant = 'success' | 'error' | 'info'

interface ToastProps {
  variant: ToastVariant
  message: string
}

const VARIANT_ICON = {
  success: Check,
  error: X,
  info: Info,
} as const

const VARIANT_ICON_COLOR: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-critical',
  info: 'text-white',
}

export function Toast({ variant, message }: ToastProps) {
  const Icon = VARIANT_ICON[variant]
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // 다음 프레임에서 mount 처리 → enter transition 동작
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'pointer-events-auto flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 shadow-md',
        'transition-all duration-[250ms] ease-out motion-reduce:transition-none',
        mounted ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0',
      )}
    >
      <Icon size={16} className={cn('shrink-0', VARIANT_ICON_COLOR[variant])} strokeWidth={3} />
      <span className="text-body-sm font-medium text-white">{message}</span>
    </div>
  )
}
