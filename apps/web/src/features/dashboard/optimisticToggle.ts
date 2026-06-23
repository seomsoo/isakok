/**
 * 체크 토글의 낙관적 업데이트 변환 (순수 함수).
 * useToggleItem의 onMutate에서 추출 — 오늘 할 일 구조와 타임라인 배열 양쪽에서 재사용한다.
 * completed_at은 호출부가 결정한 시각(now)을 주입받아 순수성을 유지한다(내부 new Date() 금지).
 */

/**
 * 대상 id면 완료 상태와 completed_at을 갱신한 새 객체를, 아니면 원본 참조를 그대로 반환한다.
 * 미변경 항목은 동일 참조라 React 재렌더 최소화에 유리.
 */
export function applyCompletionToggle(
  item: Record<string, unknown>,
  targetId: string,
  isCompleted: boolean,
  now: string,
): Record<string, unknown> {
  if (item.id !== targetId) return item
  return {
    ...item,
    is_completed: isCompleted,
    completed_at: isCompleted ? now : null,
  }
}

/** 리스트에서 대상 id만 토글하고 나머지는 보존한다. */
export function toggleItemsCompletion(
  items: Record<string, unknown>[],
  targetId: string,
  isCompleted: boolean,
  now: string,
): Record<string, unknown>[] {
  return items.map((item) => applyCompletionToggle(item, targetId, isCompleted, now))
}
