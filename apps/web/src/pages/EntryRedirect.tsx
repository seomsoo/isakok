import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { Loader2 } from 'lucide-react'

export function EntryRedirect() {
  const navigate = useNavigate()
  const { data: move, isLoading, isError } = useCurrentMove()

  useEffect(() => {
    if (isLoading) return
    if (isError || !move) {
      navigate('/onboarding', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [move, isLoading, isError, navigate])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
