import * as Sentry from '@sentry/react'
import { getEnv } from './env'
import { scrubEvent } from './scrub'

/**
 * SDK init과 소스맵 업로드가 동일 release를 쓰도록(§1-2 — 불일치 시 매핑 안 됨),
 * vite.config가 한 번 계산해 `__SENTRY_RELEASE__` define으로 주입한 값을 그대로 사용한다.
 * (Vitest 등 define 미적용 환경 대비 typeof 가드)
 */
function getSentryRelease(): string | undefined {
  const injected = typeof __SENTRY_RELEASE__ !== 'undefined' ? __SENTRY_RELEASE__ : ''
  return injected || undefined
}

/**
 * Sentry 초기화 (스펙 11 §1, ADR-085 — 웹 전용 에러 추적)
 *
 * - 웹 층(@sentry/react)만: WebView 안 React 에러·unhandled rejection·API 실패.
 *   네이티브 셸 크래시는 스토어 콘솔(Android Vitals / App Store Connect)에 위임.
 * - `tracesSampleRate: 0` — performance tracing 미사용(출시 전 목표는 에러 감지).
 * - `sendDefaultPii: false` — SDK가 사용자 IP를 추론·수집하지 않음(@sentry SDK v10.4+ 동작).
 * - `beforeSend`에서 PII/자격증명 스크럽(§5-2).
 * - DSN 미설정 시 조용히 비활성(§9 — 관측 도구가 앱을 깨면 안 됨).
 *
 * ⚠️ WebView 내부에서 Sentry ingest 도메인이 CSP/네트워크 allowlist에 허용돼야 전송됨(§1-5).
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return // 미설정 환경(로컬·키 누락)에서는 비활성

  try {
    Sentry.init({
      dsn,
      environment: getEnv(),
      // release/소스맵 upload와 동일값(§1-2). vite.config에서 isakok-web@<sha>로 주입.
      release: getSentryRelease(),
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: (event) => scrubEvent(event),
    })
  } catch (err) {
    // init 실패가 앱을 깨면 안 됨 — 로그만.
    console.warn('[sentry] init failed', err)
  }
}

/**
 * Sentry user context를 id만으로 설정 (§5-2 — email/주소/ip 금지).
 * AUTH_SESSION 수신 시 호출.
 */
export function setSentryUser(userId: string): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  Sentry.setUser({ id: userId })
}

/** 로그아웃/세션 종료 시 user context 제거. */
export function clearSentryUser(): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  Sentry.setUser(null)
}
