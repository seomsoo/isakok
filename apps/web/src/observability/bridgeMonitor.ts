import * as Sentry from '@sentry/react'
import type { SeverityLevel } from '@sentry/react'
import { isNativeWebView } from '@moving/shared'
import { getEnv, isProduction } from './env'

/**
 * 브릿지 실패 로깅 (스펙 11 §1-2/§1-3, ADR-085)
 *
 * 웹 Sentry와 네이티브 스토어 콘솔 사이 사각지대인 "브릿지 실패(조용한 실패)"를
 * 웹에서 명시 캡처한다. false positive 방어가 핵심:
 *  - 네이티브 WebView에서만 측정 (일반 브라우저·공개 라우트 제외)
 *  - 타임아웃 10~15초 (콜드스타트·느린 기기·재주입 지연 흡수 — 5초는 너무 짧음)
 *  - 동일 WebView instance당 1회만 capture (탭 재마운트·재시도 폭주 방지)
 *  - production만 Sentry warning, development는 console.warn만
 *  - 컨텍스트는 전부 비식별 allowlist (route/elapsed/instance/env). PII 금지.
 */

// WebView JS 컨텍스트 1개 = WebView instance 1개. 콜드 리로드 시 새 id(=정상적 새 측정).
const WEBVIEW_INSTANCE_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `inst-${Date.now()}-${Math.round(Math.random() * 1e9)}`

// AUTH_SESSION 미수신 타임아웃. 콜드스타트/느린 기기 흡수를 위해 12초.
const AUTH_SESSION_TIMEOUT_MS = 12_000

// 세션 게이트 바깥이라 AUTH_SESSION이 원래 안 오는 공개 라우트 — 타이머 제외.
const SESSION_LESS_ROUTES = ['/privacy', '/terms', '/oss-licenses']

let authTimer: ReturnType<typeof setTimeout> | null = null
let authResolved = false // AUTH_SESSION 수신 또는 타임아웃 발생 후 재시작 방지
let authTimeoutCaptured = false // instance당 1회만
let malformedCaptured = false // instance당 1회만 (storm 방지)

function isSessionLessRoute(pathname: string): boolean {
  return SESSION_LESS_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

/**
 * WEB_READY 전송 직후 호출 — AUTH_SESSION 수신까지의 타임아웃 측정 시작.
 * 네이티브 WebView가 아니거나 공개 라우트면 아무것도 하지 않음.
 * @param pathname WebView 진입 시점의 라우트 경로
 */
export function startBridgeAuthTimer(pathname: string): void {
  if (!isNativeWebView()) return
  if (isSessionLessRoute(pathname)) return
  if (authResolved || authTimer) return

  const startedAt = Date.now()
  authTimer = setTimeout(() => {
    authTimer = null
    if (authResolved || authTimeoutCaptured) return
    authTimeoutCaptured = true
    captureBridge('bridge_auth_session_timeout', 'warning', {
      route_name: pathname,
      elapsed_ms: Date.now() - startedAt,
    })
  }, AUTH_SESSION_TIMEOUT_MS)
}

/** AUTH_SESSION 수신 시 호출 — 타임아웃 측정 취소(정상 흐름). */
export function cancelBridgeAuthTimer(): void {
  authResolved = true
  if (authTimer) {
    clearTimeout(authTimer)
    authTimer = null
  }
}

/**
 * BridgeMessage 계약 위반 시 호출 (§1-2).
 * 메시지 원문은 절대 포함하지 않음(payload에 PII 가능) — reason 코드만.
 * @param reason 'parse'(JSON 파싱 실패) | 'shape'({version:1,data:{type}} 위반)
 */
export function reportMalformedBridgeMessage(reason: 'parse' | 'shape'): void {
  if (!isNativeWebView()) return
  if (malformedCaptured) return
  malformedCaptured = true
  captureBridge('bridge_message_malformed', 'warning', { reason })
}

/** 비식별 컨텍스트로 Sentry warning 전송 (prod) 또는 console.warn (dev). */
function captureBridge(
  name: string,
  level: SeverityLevel,
  extra: Record<string, string | number>,
): void {
  const context = {
    webview_instance_id: WEBVIEW_INSTANCE_ID,
    app_env: getEnv(),
    is_native_webview: true,
    ...extra,
  }

  if (!isProduction()) {
    console.warn(`[bridge] ${name}`, context)
    return
  }
  if (!import.meta.env.VITE_SENTRY_DSN) return
  Sentry.captureMessage(name, {
    level,
    tags: { bridge: name },
    contexts: { bridge: context },
  })
}
