import { Navigate, Link } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Settings } from 'lucide-react'
import {
  ROUTES,
  calculateProgress,
  calculateEssentialProgress,
} from '@moving/shared'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { useDashboardItemsWithMode } from '@/features/dashboard/hooks/useTodayItems'
import { useToggleItem } from '@/features/dashboard/hooks/useToggleItem'
import { useTimelineItemsForProgress } from '@/features/dashboard/hooks/useTimelineItemsForProgress'
import { useUrgencyMode } from '@/features/dashboard/hooks/useUrgencyMode'
import { useModeStore } from '@/stores/modeStore'
import { GreetingHeader } from '@/features/dashboard/components/GreetingHeader'
import { DdayCard } from '@/features/dashboard/components/DdayCard'
import { ActionSection } from '@/features/dashboard/components/ActionSection'
import { MotivationCard } from '@/features/dashboard/components/MotivationCard'
import { UpcomingSection } from '@/features/dashboard/components/UpcomingSection'
import { PhotoPromptCard } from '@/features/dashboard/components/PhotoPromptCard'
import { ModeTransitionBanner } from '@/features/dashboard/components/ModeTransitionBanner'
import { PageHeader } from '@/shared/components/PageHeader'
import { DevTabBar } from '@/shared/components/DevTabBar'
import { Skeleton } from '@/shared/components/Skeleton'

export function DashboardPage() {
  const { data: move, isPending, isFetching } = useCurrentMove()
  const moveId = move?.id ?? ''
  const movingDate = move?.moving_date ?? ''
  const { mode, daysUntilMove, isTransitioned, transitionMessage } = useUrgencyMode(movingDate)
  const dismissTransition = useModeStore((s) => s.dismissTransition)
  const { data: dashboardData, isLoading: isDashLoading } = useDashboardItemsWithMode(
    moveId,
    mode,
    movingDate,
  )
  const { data: allItems } = useTimelineItemsForProgress(moveId)
  const toggleMutation = useToggleItem(moveId)

  if (isPending || (isFetching && !move)) return <DashboardSkeleton />
  if (!move) return <Navigate to={ROUTES.LANDING} replace />

  const daysRemaining = differenceInCalendarDays(parseISO(move.moving_date), new Date())
  const isEssentialMode = mode === 'urgent' || mode === 'critical'
  const progress = isEssentialMode
    ? calculateEssentialProgress(
        (allItems ?? []).map((item) => ({
          is_completed: item.is_completed,
          is_skippable:
            (item.master_checklist_items as { is_skippable?: boolean } | null)?.is_skippable ===
            true,
        })),
      )
    : calculateProgress(allItems ?? [])

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

      <GreetingHeader mode={mode} />

      {isTransitioned && transitionMessage && (
        <div className="mt-4">
          <ModeTransitionBanner message={transitionMessage} onDismiss={dismissTransition} />
        </div>
      )}

      <div className="mt-5">
        <DdayCard
          daysRemaining={daysRemaining}
          movingDate={move.moving_date}
          completed={progress.completed}
          total={progress.total}
          mode={mode}
        />
      </div>

      {isDashLoading ? (
        <div className="mt-6 px-5">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <MotivationCard completed={progress.completed} total={progress.total} mode={mode} />
          <ActionSection
            items={actionItems}
            nextUpcomingDate={nextUpcomingDate}
            mode={mode}
            onToggle={handleToggle}
          />

          <UpcomingSection items={upcoming} mode={mode} />
        </>
      )}

      <PhotoPromptCard daysRemaining={daysRemaining} mode={mode} />

      <DevTabBar />
      {/* daysUntilMove referenced for future use */}
      <span className="sr-only">{daysUntilMove}</span>
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
