import { ChevronLeft } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ROUTES } from '@shared/constants/routes'
import { useGoBack } from '@/shared/hooks/useGoBack'
import { PageHeader } from '@/shared/components/PageHeader'
import { Skeleton } from '@/shared/components/Skeleton'
import { SectionDivider } from '@/shared/components/SectionDivider'
import { DetailHeader } from '@/features/checklist-detail/components/DetailHeader'
import { GuideStepsSection } from '@/features/checklist-detail/components/GuideStepsSection'
import { GuideItemsSection } from '@/features/checklist-detail/components/GuideItemsSection'
import { GuideNoteSection } from '@/features/checklist-detail/components/GuideNoteSection'
import { RelatedLinkCard } from '@/features/checklist-detail/components/RelatedLinkCard'
import { MemoSection } from '@/features/checklist-detail/components/MemoSection'
import { CompletionStamp } from '@/features/checklist-detail/components/CompletionStamp'
import { CompletionToggleButton } from '@/features/checklist-detail/components/CompletionToggleButton'
import { useChecklistItemDetail } from '@/features/checklist-detail/hooks/useChecklistItemDetail'
import { useToggleItem } from '@/features/dashboard/hooks/useToggleItem'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { useUrgencyMode } from '@/features/dashboard/hooks/useUrgencyMode'
import { useUserId } from '@/auth/useSession'

export function ChecklistDetailPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const [searchParams] = useSearchParams()
  const from = searchParams.get('from')
  const goBack = useGoBack(from === 'timeline' ? ROUTES.TIMELINE : ROUTES.DASHBOARD)
  const { userId } = useUserId()
  const uid = userId ?? ''
  const { data: item, isLoading, isError } = useChecklistItemDetail(itemId, uid)
  const toggleItem = useToggleItem(item?.move_id ?? '', uid)
  const { data: move } = useCurrentMove()
  const { mode } = useUrgencyMode(move?.moving_date ?? '')

  const backButton = (
    <button
      type="button"
      aria-label="뒤로 가기"
      onClick={goBack}
      className="flex h-11 w-11 items-center justify-center -ml-3"
    >
      <ChevronLeft size={24} className="text-secondary" />
    </button>
  )

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-neutral">
        <PageHeader title="" left={backButton} />
        <div className="mx-auto max-w-[430px] px-5 pb-8">
          {/* DetailHeader: badges + title + date */}
          <div className="pt-2 pb-3">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-14 rounded-lg" />
              <Skeleton className="h-5 w-12 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-8 w-4/5" />
            <Skeleton className="mt-2 h-4 w-36" />
          </div>
          {/* GuideStepsSection: numbered steps */}
          <div className="mt-3 space-y-4">
            <Skeleton className="h-4 w-24" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3.5">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <Skeleton className="h-5 flex-1" />
              </div>
            ))}
          </div>
          {/* GuideNoteSection */}
          <div className="mt-8 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
          {/* MemoSection */}
          <div className="mt-8 space-y-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !item) {
    return (
      <div className="min-h-dvh bg-neutral">
        <PageHeader title="" left={backButton} />
        <div className="mx-auto flex max-w-[430px] flex-col items-center gap-4 px-5 py-16">
          <p className="text-body text-muted">항목을 불러올 수 없어요</p>
          <button
            type="button"
            onClick={goBack}
            className="rounded-xl bg-primary px-5 py-3 text-body-sm font-semibold text-white"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    )
  }

  const master = item.master_checklist_items as {
    title: string
    description: string | null
    guide_content: string | null
    guide_steps: string[] | null
    guide_items: string[] | null
    guide_note: string | null
    guide_url: string | null
    guide_type: 'tip' | 'warning' | 'critical'
    category: string
    d_day_offset: number
    housing_types: string[]
    contract_types: string[]
    move_types: string[]
  }

  const userConditions = move
    ? {
        housing_type: move.housing_type as '원룸' | '오피스텔' | '빌라' | '아파트' | '투룸+',
        contract_type: move.contract_type as '월세' | '전세',
        move_type: move.move_type as '용달' | '반포장' | '포장' | '자가용',
      }
    : null

  const handleToggle = () => {
    toggleItem.mutate({
      itemId: item.id,
      isCompleted: !item.is_completed,
    })
  }

  return (
    <div className="min-h-dvh bg-neutral">
      <PageHeader title="" left={backButton} />
      <div className="animate-fade-in relative mx-auto max-w-[430px] px-5 pb-32">
        {item.is_completed && <CompletionStamp />}
        <DetailHeader
          title={master.title}
          category={master.category}
          guideType={master.guide_type}
          assignedDate={item.assigned_date}
          dDayOffset={master.d_day_offset}
          mode={mode}
        />

        {master.guide_steps && master.guide_steps.length > 0 && (
          <GuideStepsSection steps={master.guide_steps} />
        )}

        {master.guide_items && master.guide_items.length > 0 && (
          <>
            <SectionDivider />
            <GuideItemsSection items={master.guide_items} />
          </>
        )}

        <SectionDivider />
        <GuideNoteSection
          note={master.guide_note}
          fallbackContent={master.guide_content}
          customGuide={item.custom_guide}
          userConditions={userConditions}
          itemConditions={{
            housing_types: master.housing_types,
            contract_types: master.contract_types,
            move_types: master.move_types,
          }}
        />

        {master.guide_url && (
          <>
            <SectionDivider />
            <RelatedLinkCard url={master.guide_url} />
          </>
        )}

        <SectionDivider />
        <MemoSection itemId={item.id} userId={uid} initialMemo={item.memo} />
      </div>

      <CompletionToggleButton
        isCompleted={item.is_completed}
        isPending={toggleItem.isPending}
        onToggle={handleToggle}
      />
    </div>
  )
}
