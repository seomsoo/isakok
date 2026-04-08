import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { ROUTES } from '@shared/constants/routes'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { MoveInfoSection } from '@/features/settings/components/MoveInfoSection'
import { MoveEditSheet } from '@/features/settings/components/MoveEditSheet'
import { SettingsMenuList } from '@/features/settings/components/SettingsMenuList'
import { PageHeader } from '@/shared/components/PageHeader'
import { Skeleton } from '@/shared/components/Skeleton'

export function SettingsPage() {
  const navigate = useNavigate()
  const { data: move, isPending, isFetching } = useCurrentMove()
  const [isEditing, setIsEditing] = useState(false)

  if (isPending || (isFetching && !move)) {
    return (
      <div className="flex min-h-dvh flex-col bg-neutral p-5" aria-hidden="true">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="mt-6 h-24 w-full rounded-2xl" />
        <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (!move) return <Navigate to={ROUTES.LANDING} replace />

  if (isEditing) {
    return <MoveEditSheet move={move} onClose={() => setIsEditing(false)} />
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral">
      <PageHeader
        title="설정"
        left={
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-secondary"
            aria-label="뒤로가기"
          >
            <ChevronLeft size={24} />
          </button>
        }
      />

      <div className="flex flex-col gap-6 px-5 pt-2">
        <MoveInfoSection move={move} onEdit={() => setIsEditing(true)} />
        <SettingsMenuList />
      </div>
    </div>
  )
}
