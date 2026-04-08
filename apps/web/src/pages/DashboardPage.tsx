import { Navigate, Link } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Settings } from 'lucide-react'
import { ROUTES } from '@shared/constants/routes'
import { calculateProgress } from '@shared/utils/progress'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { useDashboardItems } from '@/features/dashboard/hooks/useTodayItems'
import { useToggleItem } from '@/features/dashboard/hooks/useToggleItem'
import { useTimelineItemsForProgress } from '@/features/dashboard/hooks/useTimelineItemsForProgress'
import { GreetingHeader } from '@/features/dashboard/components/GreetingHeader'
import { DdayCard } from '@/features/dashboard/components/DdayCard'
import { ActionSection } from '@/features/dashboard/components/ActionSection'
import { MotivationCard } from '@/features/dashboard/components/MotivationCard'
import { UpcomingSection } from '@/features/dashboard/components/UpcomingSection'
import { PhotoPromptCard } from '@/features/dashboard/components/PhotoPromptCard'
import { PageHeader } from '@/shared/components/PageHeader'
import { DevTabBar } from '@/shared/components/DevTabBar'
import { Skeleton } from '@/shared/components/Skeleton'

export function DashboardPage() {
  const { data: move, isPending, isFetching } = useCurrentMove()
  const moveId = move?.id ?? ''
  const { data: dashboardData, isLoading: isDashLoading } = useDashboardItems(moveId)
  const { data: allItems } = useTimelineItemsForProgress(moveId)
  const toggleMutation = useToggleItem(moveId)

  if (isPending || (isFetching && !move)) return <DashboardSkeleton />
  if (!move) return <Navigate to={ROUTES.LANDING} replace />

  const daysRemaining = differenceInCalendarDays(parseISO(move.moving_date), new Date())
  const progress = calculateProgress(allItems ?? [])

  function handleToggle(id: string, isCompleted: boolean) {
    toggleMutation.mutate({ itemId: id, isCompleted })
  }

  const overdue = dashboardData?.overdue ?? []
  const today = dashboardData?.today ?? []
  const upcoming = dashboardData?.upcoming ?? []
  const actionItems = [...overdue, ...today]

  const nextUpcomingDate = upcoming[0]
    ? format(parseISO(upcoming[0].assigned_date as string), 'M월 d일 (E)', { locale: ko })
    : undefined

  return (
    <div className="flex min-h-dvh flex-col bg-neutral pb-20">
      <PageHeader
        left={<span className="text-h3 font-bold text-primary">이사콕</span>}
        right={
          <Link
            to={ROUTES.SETTINGS}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted"
            aria-label="설정"
          >
            <Settings size={22} />
          </Link>
        }
      />

      <GreetingHeader daysRemaining={daysRemaining} />

      <div className="mt-5">
        <DdayCard
          daysRemaining={daysRemaining}
          movingDate={move.moving_date}
          completed={progress.completed}
          total={progress.total}
        />
      </div>

      {isDashLoading ? (
        <div className="mt-6 px-5">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <MotivationCard completed={progress.completed} total={progress.total} />
          <ActionSection
            items={actionItems}
            nextUpcomingDate={nextUpcomingDate}
            onToggle={handleToggle}
          />

          <UpcomingSection items={upcoming} />
        </>
      )}

      <PhotoPromptCard daysRemaining={daysRemaining} />

      <DevTabBar />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral p-5 pb-20" aria-hidden="true">
      <Skeleton className="h-8 w-16" />
      <Skeleton className="mt-6 h-8 w-48" />
      <Skeleton className="mt-2 h-5 w-32" />
      <Skeleton className="mt-5 h-36 w-full rounded-2xl" />
      <Skeleton className="mt-6 h-6 w-24" />
      <Skeleton className="mt-3 h-40 w-full rounded-2xl" />
    </div>
  )
}
