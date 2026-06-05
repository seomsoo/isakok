/**
 * 관측 레이어 환경 판정 (스펙 11 §4, ADR-088 — 스펙 본문 표기 ADR-087)
 *
 * dev=prod 단일 Supabase 프로젝트(ADR-075)지만 관측 레이어(Sentry/PostHog)는
 * 환경을 분리해 내 테스트가 prod 지표·알림을 오염시키지 않게 한다.
 *
 * 판정 순서: `VITE_APP_ENV` 명시 변수 1순위 → host/빌드 모드 fallback.
 * preview/internal/prod alias가 섞여 host 기반 판정만으론 오분류 위험이 있어,
 * Vercel deployment별로 `VITE_APP_ENV`를 명시 주입하는 것을 전제로 한다.
 */
export type AppEnv = 'development' | 'production'

/** VITE_APP_ENV 누락 경고를 prod 빌드에서 1회만 출력하기 위한 플래그. */
let warnedMissingEnv = false

/**
 * 현재 앱 환경을 반환.
 * @returns `VITE_APP_ENV`가 유효하면 그 값, 미설정이면 안전하게 `development`
 */
export function getEnv(): AppEnv {
  const explicit = import.meta.env.VITE_APP_ENV
  if (explicit === 'production' || explicit === 'development') return explicit
  // VITE_APP_ENV 미설정 시 development로 폴백. production 빌드라도 prod로 보지 않는다(Codex P2):
  // prod 배포는 항상 VITE_APP_ENV=production을 명시 주입하므로, 미설정 = preview/internal/로컬로
  // 간주하는 게 안전하다(prod로 오분류하면 preview 활동이 prod 관측을 오염시킴). prod 빌드면 1회 경고.
  if (import.meta.env.PROD && !warnedMissingEnv) {
    warnedMissingEnv = true
    console.warn(
      '[observability] VITE_APP_ENV 미설정 — development로 폴백. prod 배포면 VITE_APP_ENV=production 주입 필요',
    )
  }
  return 'development'
}

/** production 환경 여부 (prod 전용 동작 게이트에 사용 — 브릿지 경고 라우팅 등) */
export function isProduction(): boolean {
  return getEnv() === 'production'
}
