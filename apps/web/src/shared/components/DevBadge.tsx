import { isProduction } from '@/observability/env'

/**
 * 비-production 채널 표시 배지 (스펙 14 §4-4) — "지금 어느 환경인가"를 사람 눈으로 구분하는
 * 사고 방지 UI. 코드 강제는 lib/envFingerprint가 담당한다.
 * pointer-events 차단 + aria-hidden이라 E2E 셀렉터·axe 게이트에 영향 없음.
 * getEnv() fallback이 development라 prod에 VITE_APP_ENV 미주입 시 배지가 뜨는데,
 * 이는 미설정을 드러내는 시끄러운 실패로 의도된 동작.
 */
export function DevBadge() {
  if (isProduction()) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-2 top-2 z-50 rounded-md bg-warning/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white"
    >
      DEV
    </div>
  )
}
