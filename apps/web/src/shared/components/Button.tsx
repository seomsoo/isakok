import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: React.ReactNode
}

const variantStyles = {
  primary: 'bg-primary text-white shadow-sm active:bg-[oklch(0.41_0.086_186.4)]',
  secondary: 'bg-border text-secondary border border-border active:bg-neutral',
  ghost: 'bg-transparent text-primary active:bg-tertiary',
  danger: 'bg-critical text-white active:bg-[oklch(0.54_0.208_25)]',
} as const

const sizeStyles = {
  sm: 'h-10 px-4 text-sm font-medium rounded-lg',
  md: 'h-12 px-5 text-body-md font-semibold rounded-xl',
  lg: 'h-[52px] px-6 text-base font-semibold rounded-xl',
} as const

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex w-full cursor-pointer items-center justify-center transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
    </button>
  )
}
