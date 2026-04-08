import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { ROUTES } from '@shared/constants/routes'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { useOverdueItems } from '@/features/pre-check/hooks/useOverdueItems'
import { useBatchComplete } from '@/features/pre-check/hooks/useBatchComplete'
import { PreCheckItem } from '@/features/pre-check/components/PreCheckItem'
import { Button } from '@/shared/components/Button'
import type { OverdueItem } from '@/services/checklist'

export function PreCheckPage() {
  const navigate = useNavigate()
  const { data: move, isPending: isMovePending } = useCurrentMove()
  const moveId = move?.id ?? ''
  const { data: overdueItems, isLoading, isError } = useOverdueItems(moveId)
  const batchComplete = useBatchComplete()
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  // 밀린 항목 없으면 바로 대시보드로
  useEffect(() => {
    if (isMovePending || isLoading) return
    if (!move) {
      navigate(ROUTES.LANDING, { replace: true })
      return
    }
    // 쿼리 에러 시 리다이렉트하지 않음 (에러 UI 표시)
    if (isError) return
    if (overdueItems && overdueItems.length === 0) {
      navigate(ROUTES.DASHBOARD, { replace: true })
    }
  }, [isMovePending, isLoading, isError, move, overdueItems, navigate])

  const grouped = useMemo(() => {
    if (!overdueItems) return []
    return groupByCategory(overdueItems)
  }, [overdueItems])

  function handleToggle(itemId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  function handleComplete() {
    if (checkedIds.size === 0) {
      navigate(ROUTES.DASHBOARD, { replace: true })
      return
    }
    batchComplete.mutate(Array.from(checkedIds), {
      onSuccess: () => navigate(ROUTES.DASHBOARD, { replace: true }),
    })
  }

  function handleSkip() {
    navigate(ROUTES.DASHBOARD, { replace: true })
  }

  if (isMovePending || isLoading || (!isError && (!overdueItems || overdueItems.length === 0))) {
    return <div className="min-h-dvh bg-neutral" />
  }

  if (isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral px-5">
        <p className="text-body text-secondary">밀린 항목을 불러오지 못했어요</p>
        <Button size="lg" onClick={() => navigate(ROUTES.DASHBOARD, { replace: true })}>
          대시보드로 이동
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral">
      {/* 헤더 */}
      <header className="flex items-start justify-between px-5 pt-5">
        <div className="pt-7">
          <h1 className="text-h1 font-bold tracking-tight text-secondary">
            이미 하신 일이 있나요?
          </h1>
          <p className="mt-2 text-body-sm text-muted">체크해두면 대시보드가 깔끔해져요</p>
        </div>
        <button
          type="button"
          onClick={handleSkip}
          className="-mr-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-secondary/5"
          aria-label="건너뛰고 대시보드로 이동"
        >
          <X size={22} className="text-muted" />
        </button>
      </header>

      {/* 항목 리스트 */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-44">
        {grouped.map((group) => (
          <div key={group.category} className="mt-6 first:mt-0">
            <p className="mb-2 px-1 text-caption font-semibold text-muted">
              {group.category} ({group.items.length})
            </p>
            <div className="flex flex-col gap-2">
              {group.items.map((item) => (
                <PreCheckItem
                  key={item.id}
                  id={item.id}
                  title={item.master_item.title}
                  isChecked={checkedIds.has(item.id)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 하단 고정 버튼 */}
      <div className="fixed inset-x-0 bottom-0 bg-neutral px-5 pb-8 pt-3">
        <Button
          size="lg"
          onClick={handleComplete}
          isLoading={batchComplete.isPending}
          className="w-full"
        >
          {checkedIds.size > 0 ? `${checkedIds.size}개 체크 완료` : '건너뛰기'}
        </Button>

        {batchComplete.isError && (
          <p className="mt-2 text-center text-caption text-critical" role="alert">
            저장에 실패했어요. 다시 시도해주세요.
          </p>
        )}
      </div>
    </div>
  )
}

interface CategoryGroup {
  category: string
  items: OverdueItem[]
}

function groupByCategory(items: OverdueItem[]): CategoryGroup[] {
  const map = new Map<string, OverdueItem[]>()

  for (const item of items) {
    const category = item.master_item.category
    const existing = map.get(category)
    if (existing) {
      existing.push(item)
    } else {
      map.set(category, [item])
    }
  }

  return Array.from(map.entries()).map(([category, groupItems]) => ({
    category,
    items: groupItems,
  }))
}
