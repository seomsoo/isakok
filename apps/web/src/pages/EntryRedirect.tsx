import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { useUserId } from '@/auth/useSession'
import { isNativeWebView } from '@moving/shared'
import { Loader2 } from 'lucide-react'

const SESSION_TIMEOUT_MS = 5000

export function EntryRedirect() {
  const navigate = useNavigate()
  const { userId, isLoading: isSessionLoading } = useUserId()
  const { data: move, isLoading: isMoveLoading, isError } = useCurrentMove()
  const isNative = isNativeWebView()
  const [timedOut, setTimedOut] = useState(!isNative)

  useEffect(() => {
    if (timedOut) return
    const timer = setTimeout(() => setTimedOut(true), SESSION_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [timedOut])

  useEffect(() => {
    if (userId) setTimedOut(true)
  }, [userId])

  useEffect(() => {
    if (!timedOut) return
    if (isNative && !userId) {
      navigate('/onboarding', { replace: true })
      return
    }
    if (isSessionLoading || isMoveLoading) return
    if (isError || !move) {
      navigate('/onboarding', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [move, isSessionLoading, isMoveLoading, isError, timedOut, userId, isNative, navigate])

  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">이사 정보를 불러오는 중입니다</span>
    </div>
  )
}
