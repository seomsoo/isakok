/**
 * 푸시 권한 모달(soft-ask) · 설정 토글 카피 (12단계 §9, 친근+깔끔 톤).
 *
 * 여기에는 웹(모달·설정)에서 쓰는 UI 문구만 둔다. 발송되는 푸시 알림 본문은 발송 시점에
 * 조건(D-day·할 일 수)으로 합성하므로 Edge Function(send-notifications/copy.ts)에 별도 보관.
 */

/** soft-ask 권한 모달 (온보딩 직후 1회). "스팸 없음 + 빈도 명시"로 신뢰 확보. */
export const PUSH_PERMISSION_COPY = {
  title: '이사, 깜빡하지 않게 챙겨드릴게요',
  body: '할 일 있는 날 아침에 딱 한 번, 필요한 것만 알려드려요. 광고·스팸은 없어요.',
  allow: '알림 받기',
  later: '나중에',
} as const

/** 설정 화면 푸시 토글 행 + effective status 안내 (§6-2). */
export const PUSH_SETTING_COPY = {
  title: '할 일 알림',
  description: '할 일 있는 날 아침에 알려드려요',
  /** OS 권한 denied — 토글 ON 불가, 기기 설정으로 유도 */
  osDisabledTitle: '기기 알림이 꺼져 있어요',
  osDisabledAction: '설정에서 켜기',
  /** granted + push_enabled=true 이지만 아직 서버 토큰 등록 전/재시도 중 */
  registering: '알림을 켜는 중이에요',
} as const
