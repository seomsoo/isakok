/**
 * 메모 자동저장의 직렬화 결정 로직 (순수 함수).
 * MemoSection의 디바운스 저장에서 추출 — React ref 상태와 분리해 단위 테스트가 가능하게 한다.
 *
 * 회귀 방지 규칙:
 * - 마지막 저장값(lastSaved)과 같으면 저장 생략 — stale prop 대신 lastSavedRef로 추적
 * - 이미 저장 중(inFlight)이면 즉시 mutate 금지 → 최신값만 pending에 버퍼링(직렬화)
 */

export type MemoSaveDecision =
  | { type: 'skip' } // lastSaved와 동일 → no-op
  | { type: 'queue'; pending: string } // 저장 중 → 최신값 버퍼링
  | { type: 'start'; value: string } // 저장 시작

/**
 * 새 입력값을 두고 지금 저장할지/버퍼링할지/건너뛸지 결정한다.
 * @param value 저장 후보 값
 * @param state lastSaved(마지막 저장 성공값) + inFlight(저장 진행 중 여부)
 */
export function decideMemoSave(
  value: string,
  state: { lastSaved: string; inFlight: boolean },
): MemoSaveDecision {
  if (value === state.lastSaved) return { type: 'skip' }
  if (state.inFlight) return { type: 'queue', pending: value }
  return { type: 'start', value }
}

export type MemoPostSave =
  | { type: 'resave'; value: string } // 버퍼된 값을 다시 저장(coalesce)
  | { type: 'settle' } // 더 저장할 게 없음 → idle로 정착

/**
 * 저장 성공 직후, 버퍼된 pending 값을 다시 저장할지 idle로 정착할지 결정한다.
 * pending이 방금 저장한 값과 다를 때만 재저장 (같으면 중복 저장 방지).
 */
export function decideAfterSave(savedValue: string, pending: string | null): MemoPostSave {
  if (pending !== null && pending !== savedValue) return { type: 'resave', value: pending }
  return { type: 'settle' }
}
