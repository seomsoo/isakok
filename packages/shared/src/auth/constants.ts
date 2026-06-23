/**
 * 앱 Supabase 클라이언트의 localStorage 세션 키 — 단일 출처.
 *
 * E2E(seed.spec.ts)가 동일한 키로 익명 세션을 주입해야 앱이 그 세션을 읽는다.
 * storageKey를 추측하면 "session missing"이 나므로(STATUS 학습: 세션 키 불일치),
 * 앱 클라이언트와 테스트가 이 상수를 단일 출처로 공유한다.
 *
 * ⚠️ 마이그레이션 불변식: 현재 웹 브라우저 런타임은 익명 세션을 자체 발급하지 않는다(세션은
 * 네이티브 셸이 브릿지로 주입, 웹 직접 접속은 미발급). 그래서 supabase-js 기본 키
 * `sb-<ref>-auth-token`에 persist된 웹 세션이 존재하지 않아, 이 커스텀 키로의 전환에
 * 마이그레이션이 불필요하다. 향후 웹 단독에서 `signInAnonymously()`(persistSession:true)를
 * 도입하면 그 시점부터 기본 키→이 키 1회 마이그레이션이 필요하다(13단계 verify Codex P1).
 */
export const SUPABASE_STORAGE_KEY = 'isakok-auth-token'
