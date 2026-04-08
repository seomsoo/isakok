import { useState, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowUpDown, Search, X, Truck, Home } from 'lucide-react'
import { ROUTES } from '@shared/constants/routes'
import { CATEGORY_CHIP_MAP } from '@shared/constants/categories'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { useTimelineItems } from '@/features/timeline/hooks/useTimelineItems'
import { useToggleItem } from '@/features/dashboard/hooks/useToggleItem'
import { PeriodSection } from '@/features/timeline/components/PeriodSection'
import { CompletedSection } from '@/features/timeline/components/CompletedSection'
import { TimelinePromptCard } from '@/features/timeline/components/TimelinePromptCard'
import { DevTabBar } from '@/shared/components/DevTabBar'
import { Skeleton } from '@/shared/components/Skeleton'
import type { PeriodGroup } from '@/features/timeline/hooks/useTimelineItems'

type SortMode = 'time' | 'category'

export function TimelinePage() {
  const { data: move, isPending, isFetching } = useCurrentMove()
  const moveId = move?.id ?? ''
  const movingDate = move?.moving_date ?? ''
  const { data: timeline, isLoading: isTimelineLoading } = useTimelineItems(moveId, movingDate)
  const toggleMutation = useToggleItem(moveId)

  const [sortMode, setSortMode] = useState<SortMode>('time')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  if (isPending || (isFetching && !move)) return <TimelineSkeleton />
  if (!move) return <Navigate to={ROUTES.LANDING} replace />

  function handleToggle(id: string, isCompleted: boolean) {
    toggleMutation.mutate({ itemId: id, isCompleted })
  }

  function handleSortSelect(mode: SortMode) {
    setSortMode(mode)
    setShowSortMenu(false)
  }

  function handleSearchOpen() {
    setShowSearch(true)
    setTimeout(() => searchRef.current?.focus(), 100)
  }

  // 검색 필터
  function filterBySearch(items: Record<string, unknown>[]) {
    if (!searchQuery.trim()) return items
    const q = searchQuery.trim().toLowerCase()
    return items.filter((item) => {
      const master = item.master_checklist_items as Record<string, unknown> | null
      return (master?.title as string)?.toLowerCase().includes(q)
    })
  }

  // 카테고리별 정렬
  function groupByCategory(periods: PeriodGroup[]): PeriodGroup[] {
    const allItems = periods.flatMap((p) => [...p.overdueItems, ...p.items])
    const grouped = new Map<string, Record<string, unknown>[]>()

    for (const item of allItems) {
      const master = item.master_checklist_items as Record<string, unknown> | null
      const category = (master?.category as string) ?? '기타'
      const existing = grouped.get(category) ?? []
      existing.push(item)
      grouped.set(category, existing)
    }

    // CATEGORY_CHIP_MAP 순서로 정렬
    const chipLabels = CATEGORY_CHIP_MAP.map((c) => c.dbCategories).flat()
    const sortedKeys = [...grouped.keys()].sort((a, b) => {
      const idxA = chipLabels.indexOf(a)
      const idxB = chipLabels.indexOf(b)
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB)
    })

    return sortedKeys
      .map((category) => {
        const items = grouped.get(category) ?? []
        return {
          key: category,
          label: category,
          items,
          completedCount: 0,
          totalCount: items.length,
          isCurrent: false,
          overdueItems: [],
        }
      })
      .filter((p) => p.totalCount > 0)
  }

  // 최종 데이터
  const basePeriods = timeline?.periods ?? []
  const displayPeriods = sortMode === 'category' ? groupByCategory(basePeriods) : basePeriods

  // 검색 적용
  const filteredPeriods: PeriodGroup[] = displayPeriods
    .map((period) => {
      const filteredItems = filterBySearch(period.items)
      const filteredOverdue = filterBySearch(period.overdueItems)
      return {
        ...period,
        items: filteredItems,
        overdueItems: filteredOverdue,
        totalCount: filteredItems.length + filteredOverdue.length,
      }
    })
    .filter((p) => p.totalCount > 0)

  const completedItems = searchQuery.trim()
    ? filterBySearch(timeline?.completedItems ?? [])
    : (timeline?.completedItems ?? [])

  const hasContent = filteredPeriods.length > 0 || completedItems.length > 0
  const progress = timeline?.progress

  return (
    <div className="flex min-h-dvh flex-col bg-neutral pb-20">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-neutral">
        {showSearch ? (
          <div className="flex items-center gap-2 px-5 py-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-surface px-3 py-2">
              <Search size={16} className="shrink-0 text-muted" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="할 일 검색"
                className="flex-1 bg-transparent text-body-sm text-secondary outline-none placeholder:text-placeholder"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')}>
                  <X size={14} className="text-muted" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowSearch(false)
                setSearchQuery('')
              }}
              className="shrink-0 text-body-sm font-medium text-primary"
            >
              취소
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2">
              <h1 className="text-h3 font-bold text-secondary">전체 할 일</h1>
              {progress && (
                <span className="text-body-sm font-medium text-primary">
                  {progress.completed}/{progress.total}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSearchOpen}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-muted"
                aria-label="검색"
              >
                <Search size={20} />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-muted"
                  aria-label="정렬"
                >
                  <ArrowUpDown size={20} />
                </button>
                {showSortMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                    <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl bg-surface shadow-lg">
                      <button
                        type="button"
                        onClick={() => handleSortSelect('time')}
                        className={`w-full px-4 py-3 text-left text-body-sm ${sortMode === 'time' ? 'font-bold text-primary' : 'text-secondary'}`}
                      >
                        시간순
                      </button>
                      <div className="mx-3 border-t border-border" />
                      <button
                        type="button"
                        onClick={() => handleSortSelect('category')}
                        className={`w-full px-4 py-3 text-left text-body-sm ${sortMode === 'category' ? 'font-bold text-primary' : 'text-secondary'}`}
                      >
                        카테고리별
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 프로그레스 바 — 화물차 → 집 */}
        {progress && (
          <div className="relative mx-5 mb-3 h-7">
            {/* 트랙 (아이콘 중심~중심) */}
            <div className="absolute top-1/2 right-3.5 left-3.5 h-1 -translate-y-1/2 rounded-full bg-border">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>

            {/* 집 아이콘 (트랙 끝) */}
            <div
              className={`absolute right-0 top-1/2 -translate-y-1/2 transition-all duration-300 ${
                progress.percentage >= 100 ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
              }`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-tertiary">
                <Home size={14} strokeWidth={2} className="text-primary" />
              </div>
            </div>

            {/* 화물차 아이콘 (진행 위치) */}
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
              style={{
                left: `calc(${progress.percentage}% - ${progress.percentage / 100} * 1.75rem)`,
              }}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral shadow-sm transition-colors duration-300 bg-primary text-white">
                {progress.percentage >= 100 ? (
                  <Home size={14} strokeWidth={2} />
                ) : (
                  <Truck size={14} strokeWidth={2} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 본문 */}
      {isTimelineLoading ? (
        <div className="px-5">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="mt-3 h-40 w-full rounded-2xl" />
        </div>
      ) : !hasContent ? (
        <p className="mt-10 text-center text-body-sm text-muted">
          {searchQuery ? '검색 결과가 없어요' : '해당하는 항목이 없어요'}
        </p>
      ) : (
        <>
          {filteredPeriods.map((period, index) => (
            <div key={period.key}>
              {index > 0 && <div className="h-2 bg-border/50" />}
              <PeriodSection period={period} movingDate={movingDate} onToggleItem={handleToggle} />
            </div>
          ))}

          <CompletedSection items={completedItems} onToggle={handleToggle} />

          <TimelinePromptCard />
        </>
      )}

      <DevTabBar />
    </div>
  )
}

function TimelineSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral p-5 pb-20" aria-hidden="true">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="mt-4 h-2 w-full rounded-full" />
      <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
      <Skeleton className="mt-3 h-40 w-full rounded-2xl" />
    </div>
  )
}
