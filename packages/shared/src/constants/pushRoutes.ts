/**
 * 푸시 딥링크 route allowlist (12단계 §6-3, ADR-095).
 *
 * 푸시 페이로드(data.route)는 신뢰 경계 밖이므로 네이티브·웹 양측에서 이 함수로 정규화한다.
 * 허용 목록에 없거나 형식이 잘못된 값(외부 URL·`javascript:`·protocol-relative `//host` 등)은
 * 모두 대시보드로 폴백한다. v1.1에서 항목별/계약 만료일 알림 추가 시 ALLOWED만 확장.
 */
const ALLOWED_PUSH_ROUTES = ['/dashboard', '/timeline', '/photos', '/settings'] as const

const FALLBACK_PUSH_ROUTE = '/dashboard'

/**
 * 푸시 route를 앱 내부 경로로 정규화 (allowlist 검증).
 * @param route - 푸시 페이로드에서 받은 임의 값 (string이 아닐 수 있음)
 * @returns 허용된 내부 경로 또는 '/dashboard' 폴백
 */
export function normalizePushRoute(route: unknown): string {
  if (typeof route !== 'string' || !route.startsWith('/')) return FALLBACK_PUSH_ROUTE
  return ALLOWED_PUSH_ROUTES.some((p) => route === p || route.startsWith(`${p}/`))
    ? route
    : FALLBACK_PUSH_ROUTE
}
