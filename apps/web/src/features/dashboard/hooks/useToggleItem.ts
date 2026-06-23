import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requestHaptic } from '@moving/shared'
import { toggleChecklistItem } from '@/services/checklist'
import { useToast } from '@/shared/components/ToastProvider'
import { captureEvent, ANALYTICS_EVENTS } from '@/observability/events'
import { toggleItemsCompletion } from '../optimisticToggle'
import { queryKeys } from './queryKeys'

export function useToggleItem(moveId: string, userId: string) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) =>
      toggleChecklistItem(itemId, moveId, userId, isCompleted),

    onMutate: async ({ itemId, isCompleted }) => {
      // 행동 이벤트 — 완료여부만(항목 텍스트/메모 금지). category는 호출부 thread 필요로 follow-up(§2-2)
      captureEvent(ANALYTICS_EVENTS.CHECKLIST_ITEM_TOGGLED, { completed: isCompleted })
      // 완료=성공 진동, 해제=가벼운 진동 (리스트·액션·상세 토글 단일 지점)
      requestHaptic(isCompleted ? 'success' : 'light')
      await queryClient.cancelQueries({ queryKey: queryKeys.todayItems(moveId) })
      await queryClient.cancelQueries({ queryKey: queryKeys.timelineItems(moveId) })

      const previousToday = queryClient.getQueryData(queryKeys.todayItems(moveId))
      const previousTimeline = queryClient.getQueryData(queryKeys.timelineItems(moveId))

      // 한 번의 토글에 단일 시각 스냅샷 — 세 섹션/타임라인이 동일 completed_at을 갖게
      const now = new Date().toISOString()

      queryClient.setQueryData(
        queryKeys.todayItems(moveId),
        (
          old:
            | {
                today: Record<string, unknown>[]
                overdue: Record<string, unknown>[]
                upcoming: Record<string, unknown>[]
              }
            | undefined,
        ) => {
          if (!old) return old
          return {
            overdue: toggleItemsCompletion(old.overdue, itemId, isCompleted, now),
            today: toggleItemsCompletion(old.today, itemId, isCompleted, now),
            upcoming: toggleItemsCompletion(old.upcoming, itemId, isCompleted, now),
          }
        },
      )

      queryClient.setQueryData(
        queryKeys.timelineItems(moveId),
        (old: Record<string, unknown>[] | undefined) => {
          if (!old) return old
          return toggleItemsCompletion(old, itemId, isCompleted, now)
        },
      )

      return { previousToday, previousTimeline }
    },

    onError: (_err, _vars, context) => {
      if (context?.previousToday) {
        queryClient.setQueryData(queryKeys.todayItems(moveId), context.previousToday)
      }
      if (context?.previousTimeline) {
        queryClient.setQueryData(queryKeys.timelineItems(moveId), context.previousTimeline)
      }
      requestHaptic('error')
      toast.error('체크 상태 변경에 실패했어요')
    },

    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todayItems(moveId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.timelineItems(moveId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.currentMove })
      queryClient.invalidateQueries({ queryKey: queryKeys.itemDetail(variables.itemId) })
    },
  })
}
