import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl bg-warning/8 px-4 py-3.5 text-[13px] text-warning"
      role="alert"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>인터넷 연결을 확인해주세요</span>
    </div>
  )
}
