import { ChevronLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
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

export function ChecklistDetailPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const navigate = useNavigate()
  const { data: item, isLoading, isError } = useChecklistItemDetail(itemId)
  const toggleItem = useToggleItem(item?.move_id ?? '')

  const backButton = (
    <button
      type="button"
      aria-label="뒤로 가기"
      onClick={() => navigate(-1)}
      className="flex h-11 w-11 items-center justify-center -ml-3"
    >
      <ChevronLeft size={24} className="text-secondary" />
    </button>
  )

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-neutral">
        <PageHeader title="항목 상세" left={backButton} />
        <div className="mx-auto max-w-[430px] px-5 pb-8">
          <Skeleton className="mt-2 h-5 w-24" />
          <Skeleton className="mt-4 h-8 w-3/4" />
          <Skeleton className="mt-2 h-4 w-32" />
          <Skeleton className="mt-8 h-4 w-24" />
          <Skeleton className="mt-4 h-16 w-full" />
        </div>
      </div>
    )
  }

  if (isError || !item) {
    return (
      <div className="min-h-dvh bg-neutral">
        <PageHeader title="항목 상세" left={backButton} />
        <div className="mx-auto flex max-w-[430px] flex-col items-center gap-4 px-5 py-16">
          <p className="text-body text-muted">항목을 불러올 수 없어요</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
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
  }

  const handleToggle = () => {
    toggleItem.mutate({
      itemId: item.id,
      isCompleted: !item.is_completed,
    })
  }

  return (
    <div className="min-h-dvh bg-neutral">
      <PageHeader title="" left={backButton} />
      <div className="relative mx-auto max-w-[430px] px-5 pb-32">
        {item.is_completed && <CompletionStamp />}
        <DetailHeader
          title={master.title}
          category={master.category}
          guideType={master.guide_type}
          assignedDate={item.assigned_date}
          dDayOffset={master.d_day_offset}
        />

        {master.guide_steps && master.guide_steps.length > 0 && (
          <GuideStepsSection
            steps={master.guide_steps}
            tip={master.guide_note ?? master.guide_content}
          />
        )}

        {master.guide_items && master.guide_items.length > 0 && (
          <>
            <SectionDivider />
            <GuideItemsSection items={master.guide_items} />
          </>
        )}

        {(!master.guide_steps || master.guide_steps.length === 0) && (
          <>
            <SectionDivider />
            <GuideNoteSection
              note={master.guide_note}
              fallbackContent={master.guide_content}
              hasSteps={false}
            />
          </>
        )}

        {master.guide_url && (
          <>
            <SectionDivider />
            <RelatedLinkCard url={master.guide_url} />
          </>
        )}

        <SectionDivider />
        <MemoSection itemId={item.id} initialMemo={item.memo} />
      </div>

      <CompletionToggleButton
        isCompleted={item.is_completed}
        isPending={toggleItem.isPending}
        onToggle={handleToggle}
      />
    </div>
  )
}
