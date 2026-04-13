import { GREETING_TEXT, type UrgencyMode } from '@moving/shared'

interface GreetingHeaderProps {
  mode: UrgencyMode
}

export function GreetingHeader({ mode }: GreetingHeaderProps) {
  return (
    <div className="px-5 pt-2">
      <h1 className="text-h1 font-bold tracking-tight text-secondary">
        {GREETING_TEXT[mode]}
      </h1>
    </div>
  )
}
