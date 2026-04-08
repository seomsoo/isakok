import { getGreetingMessage } from '@shared/constants/greetings'

interface GreetingHeaderProps {
  daysRemaining: number
}

export function GreetingHeader({ daysRemaining }: GreetingHeaderProps) {
  return (
    <div className="px-5 pt-2">
      <h1 className="text-h1 font-bold tracking-tight text-secondary">
        {getGreetingMessage(daysRemaining)}
      </h1>
    </div>
  )
}
