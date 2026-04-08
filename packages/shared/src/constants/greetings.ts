/**
 * 대시보드 인사 문구
 * D-Day 남은 일수에 따라 동적으로 표시
 * 5단계에서 스마트 재배치 모드와 연결
 */
export const GREETINGS: { maxDays: number; message: string }[] = [
  { maxDays: -8, message: '이사 잘 마무리했어요!' },
  { maxDays: -1, message: '새 집 마무리, 거의 다 왔어요' },
  { maxDays: 0, message: '오늘이 이사 날이에요' },
  { maxDays: 6, message: '필수만 챙기면 돼요' },
  { maxDays: 13, message: '중요한 것부터 챙겨요' },
  { maxDays: 29, message: '차근차근 챙겨봐요' },
  { maxDays: Infinity, message: '여유 있게 준비해요' },
]

/**
 * 남은 일수에 맞는 인사 문구 반환
 * @param daysRemaining - 이사일까지 남은 일수 (음수면 이미 지남)
 */
export function getGreetingMessage(daysRemaining: number): string {
  for (const greeting of GREETINGS) {
    if (daysRemaining <= greeting.maxDays) return greeting.message
  }
  return '여유 있게 준비해요'
}
