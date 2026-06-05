import posthog from 'posthog-js'
import { getEnv } from './env'

/**
 * PostHog 초기화 + 식별 (스펙 11 §2, ADR-086)
 *
 * - 이벤트만 수동 전송: autocapture·세션 리플레이·자동 pageview·person properties off(§2-1).
 * - 리전 US (한국 리전 없음; PII 없는 이벤트라 US/EU 실익 없어 풀세트인 US).
 * - distinct_id = Supabase auth.uid() (익명 포함). AUTH_SESSION 후 identify(§2-3).
 * - 키 미설정 시 조용히 비활성(§9). Free 플랜(1 프로젝트)이라 dev/prod는 environment 태그로 구분(§4, ADR-088).
 * - IP: 코드에서 IP 속성을 절대 추가하지 않음 + PostHog 프로젝트 설정 "Discard client IP"로 차단(§5-3).
 *
 * ⚠️ WebView에서 PostHog ingest 도메인이 CSP/네트워크 allowlist에 허용돼야 전송됨(§9).
 */
let initialized = false

export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key || initialized) return

  try {
    posthog.init(key, {
      api_host: 'https://us.i.posthog.com', // US 리전 ingest
      ui_host: 'https://us.posthog.com',
      autocapture: false, // §2-1 — 명시 이벤트만
      capture_pageview: false, // 자동 pageview off
      capture_pageleave: false,
      disable_session_recording: true, // 세션 리플레이 off
      // identify된 사용자만 person profile 생성 — 우리는 AUTH_SESSION 후 uid로 identify(§2-3)
      person_profiles: 'identified_only',
    })
    // dev/prod 분리: 단일 프로젝트라 별도 키 대신 environment 태그로 구분(§4, ADR-088). 모든 이벤트에
    // 자동 부착(super property) → 대시보드에서 environment=production 필터(Sentry environment 태그와 동일).
    posthog.register({ environment: getEnv() })
    initialized = true
  } catch (err) {
    // init 실패가 앱을 깨면 안 됨(§9)
    console.warn('[posthog] init failed', err)
  }
}

/**
 * distinct_id를 auth.uid()로 식별 (§2-3). 익명 사용자도 uid가 있어 동일하게 identify.
 * linkIdentity는 uid가 유지되므로 alias 불필요(미사용).
 */
export function identifyAnalyticsUser(userId: string): void {
  if (!import.meta.env.VITE_POSTHOG_KEY) return
  try {
    posthog.identify(userId)
  } catch {
    /* 관측 실패는 무시(§9) */
  }
}

/**
 * distinct_id 초기화 — 계정 삭제 직후 새 익명 세션 시작 전 호출.
 * 이후 이벤트가 삭제된 이전 userId에 묶이지 않게 한다(§2-2 account_delete_completed).
 */
export function resetAnalyticsUser(): void {
  if (!import.meta.env.VITE_POSTHOG_KEY) return
  try {
    posthog.reset()
  } catch {
    /* 관측 실패는 무시(§9) */
  }
}
