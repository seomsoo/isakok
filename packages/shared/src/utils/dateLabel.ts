/**
 * D-Day offset을 상대적 시간 표현으로 변환
 * 전체 리스트 그룹핑과 일관된 언어를 유지하기 위해 상세 페이지에서도 동일 체계 사용
 * @param dDayOffset - 이사일 기준 offset (음수: 이전, 0: 당일, 양수: 이후)
 */
export function getRelativeDateLabel(dDayOffset: number): string {
  if (dDayOffset <= -21) return '이사 4주 전'
  if (dDayOffset <= -14) return '이사 2~3주 전'
  if (dDayOffset <= -7) return '이사 1~2주 전'
  if (dDayOffset <= -3) return '이사 1주 전'
  if (dDayOffset === -2) return '이사 이틀 전'
  if (dDayOffset === -1) return '이사 전날'
  if (dDayOffset === 0) return '이사 당일'
  if (dDayOffset === 1) return '이사 다음 날'
  if (dDayOffset <= 7) return '입주 첫 주'
  return `D${dDayOffset > 0 ? '+' : ''}${dDayOffset}`
}

/**
 * YYYY-MM-DD 문자열을 로컬 시간대의 Date로 파싱
 * `new Date('YYYY-MM-DD')`는 UTC로 해석되어 UTC- 타임존에서 하루 밀리는 이슈를 방지
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

/**
 * assigned_date (YYYY-MM-DD)를 한국어 날짜 포맷으로 변환
 * 예: "3월 26일 (수)"
 */
export function formatDateKorean(dateStr: string): string {
  const date = parseLocalDate(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
  return `${month}월 ${day}일 (${weekday})`
}
