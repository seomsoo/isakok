/**
 * 전체 기준 진행률 (여유/빠듯 모드용)
 */
export function calculateProgress(items: { is_completed: boolean }[]) {
  const total = items.length
  const completed = items.filter((item) => item.is_completed).length
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
}

/**
 * 필수 기준 진행률 (급한/초급한 모드용)
 * is_skippable=false 항목만 카운트. "필수 2/5 완료" 같은 압박 감소 표시에 사용.
 */
export function calculateEssentialProgress(
  items: { is_completed: boolean; is_skippable: boolean }[],
) {
  const essentials = items.filter((item) => !item.is_skippable)
  const total = essentials.length
  const completed = essentials.filter((item) => item.is_completed).length
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
}
