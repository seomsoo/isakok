/**
 * 전체 기준 진행률 계산
 * 여유/빠듯 모드에서 사용 (급한/초급한은 5단계에서 필수 기준으로 전환)
 * @param items - is_completed 필드를 가진 배열
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
