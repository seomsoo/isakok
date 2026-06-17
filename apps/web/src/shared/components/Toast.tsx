import { useEffect, useState } from 'react'
import { Check, X, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ToastVariant = 'success' | 'error' | 'info'

interface ToastProps {
  variant: ToastVariant
  message: string
  leaving?: boolean
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

export function Toast({ variant, message, leaving = false }: ToastProps) {
  const Icon = VARIANT_ICON[variant]
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // 다음 프레임에서 mount 처리 → enter transition 동작
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // 진입: transform + opacity 250ms ease-out / 퇴장: opacity 150ms ease-in (DESIGN.md §8)
  const visible = mounted && !leaving

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'pointer-events-auto flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 shadow-md',
        'motion-reduce:transition-none',
        leaving
          ? 'transition-opacity duration-150 ease-in'
          : 'transition-all duration-[250ms] ease-out',
        visible ? 'translate-y-0 opacity-100' : 'opacity-0',
        !mounted && '-translate-y-3',
      )}
    >
      <Icon size={16} className={cn('shrink-0', VARIANT_ICON_COLOR[variant])} strokeWidth={3} />
      <span className="text-body-sm font-medium text-white">{message}</span>
    </div>
  )
}
