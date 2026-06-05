import posthog from 'posthog-js'

/**
 * PostHog 이벤트 택소노미 + 속성 화이트리스트 (스펙 11 §2-2, §5-3, ADR-086/089)
 *
 * → MAU · 온보딩 퍼널 · 사진 게이트 전환율 · 리텐션 산출 근거.
 * 속성은 비식별 화이트리스트만 통과(상수로 강제). 항목 텍스트·메모·경로·파일명·custom room name 금지.
 * bridge_* 류(타임아웃/파싱 실패)는 Sentry 전용 — PostHog로 중복 전송하지 않음(§2-2).
 */
export const ANALYTICS_EVENTS = {
  // 온보딩 퍼널
  ONBOARDING_STARTED: 'onboarding_started',
  MOVING_DATE_SET: 'moving_date_set',
  CHECKLIST_GENERATED: 'checklist_generated',
  // 인증 (web은 익명→식별 전환 시점만 관측 — 아래 wiring 참고)
  SIGNUP: 'signup',
  LOGIN: 'login',
  // 계정 삭제
  ACCOUNT_DELETE_REQUESTED: 'account_delete_requested',
  ACCOUNT_DELETE_COMPLETED: 'account_delete_completed',
  ACCOUNT_DELETE_FAILED: 'account_delete_failed',
  // 사진 게이트 (ADR-074)
  PHOTO_GATE_SHOWN: 'photo_gate_shown',
  PHOTO_GATE_LOGIN_CLICKED: 'photo_gate_login_clicked',
  PHOTO_GATE_CANCELLED: 'photo_gate_cancelled',
  // 네이티브 미디어 (ADR-079)
  NATIVE_MEDIA_PICKER_OPENED: 'native_media_picker_opened',
  NATIVE_MEDIA_UPLOAD_SUCCEEDED: 'native_media_upload_succeeded',
  NATIVE_MEDIA_UPLOAD_FAILED: 'native_media_upload_failed',
  // 행동
  CHECKLIST_ITEM_TOGGLED: 'checklist_item_toggled',
  PHOTO_UPLOADED: 'photo_uploaded',
  RESCHEDULE_MODE_CHANGED: 'reschedule_mode_changed',
} as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

export type EventProps = Record<string, string | number | boolean>

/**
 * 이벤트별 허용 속성 (§2-2 — PII 차단을 상수로 강제).
 * 미등록 이벤트는 속성 없이만 전송. 등록된 이벤트는 나열된 키만 통과.
 */
const ALLOWED_EVENT_PROPS: Partial<Record<AnalyticsEvent, readonly string[]>> = {
  [ANALYTICS_EVENTS.CHECKLIST_ITEM_TOGGLED]: ['category', 'completed'],
  [ANALYTICS_EVENTS.PHOTO_UPLOADED]: ['count', 'room_type'],
  [ANALYTICS_EVENTS.RESCHEDULE_MODE_CHANGED]: ['mode'],
  [ANALYTICS_EVENTS.NATIVE_MEDIA_PICKER_OPENED]: ['kind'],
  [ANALYTICS_EVENTS.NATIVE_MEDIA_UPLOAD_SUCCEEDED]: ['count'],
  [ANALYTICS_EVENTS.NATIVE_MEDIA_UPLOAD_FAILED]: ['count'],
  [ANALYTICS_EVENTS.PHOTO_GATE_SHOWN]: ['source'],
  [ANALYTICS_EVENTS.PHOTO_GATE_LOGIN_CLICKED]: ['source'],
  [ANALYTICS_EVENTS.PHOTO_GATE_CANCELLED]: ['source'],
  [ANALYTICS_EVENTS.LOGIN]: ['provider'],
  [ANALYTICS_EVENTS.SIGNUP]: ['provider'],
}

/** 화이트리스트에 있는 키만 남김(없으면 속성 제거). 단위 테스트를 위해 export. */
export function filterProps(event: AnalyticsEvent, props?: EventProps): EventProps | undefined {
  if (!props) return undefined
  const allowed = ALLOWED_EVENT_PROPS[event]
  if (!allowed) return undefined
  const filtered: EventProps = {}
  for (const key of allowed) {
    const value = props[key]
    if (value !== undefined) filtered[key] = value
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined
}

/**
 * 분석 이벤트 전송 — 허용 속성만 통과(§2-2/§5-3).
 * 전송 실패가 앱을 깨면 안 됨(§9) — swallow.
 */
export function captureEvent(event: AnalyticsEvent, props?: EventProps): void {
  if (!import.meta.env.VITE_POSTHOG_KEY) return
  try {
    posthog.capture(event, filterProps(event, props))
  } catch {
    /* 관측 실패는 무시(§9) */
  }
}
