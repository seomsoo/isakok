import type { AppEnv } from '@/observability/env'

// 공개 식별자 — 클라이언트 번들 URL에 이미 인라인되는 값이라 secret이 아니다 (스펙 14 §5-6).
const PROD_REF = 'ybcqinanfcarhqkclvue'

// hosted Supabase URL에서만 ref 추출 — 로컬 스택(http://127.0.0.1:54321)은 검증 제외라 E2E·로컬 Docker 무영향.
const HOSTED_URL_PATTERN = /^https:\/\/([a-z0-9]+)\.supabase\.co$/

/**
 * 앱 환경 × Supabase 프로젝트 ref 조합을 startup에서 검증 (스펙 14 §5-6, ADR-108).
 * DEV 배지가 사람용이라면 이 함수는 코드 강제 — 잘못된 빌드가 조용히 다른 환경 데이터를
 * 읽고 쓰는 것을 렌더 전에 차단한다.
 * @param supabaseUrl - 빌드에 인라인된 VITE_SUPABASE_URL
 * @param env - getEnv() 판정 결과
 * @throws production 빌드가 prod가 아닌 ref를 보거나, 비-production 빌드가 prod ref를 볼 때
 */
export function assertEnvRefPairing(supabaseUrl: string | undefined, env: AppEnv): void {
  if (!supabaseUrl) return // 누락 자체는 lib/supabase.ts가 throw로 처리

  // 정규화 후 매치 — trailing slash·공백·대소문자 변형(supabase-js는 정상 수용)이
  // 패턴 불일치 → 조용한 skip으로 빠져 검증이 우회되는 것을 방지 (verify Codex P2)
  const normalized = supabaseUrl.trim().toLowerCase().replace(/\/+$/, '')
  const match = HOSTED_URL_PATTERN.exec(normalized)
  if (!match) return

  const ref = match[1]
  if (env === 'production' && ref !== PROD_REF) {
    throw new Error(
      `[envFingerprint] production 빌드가 prod가 아닌 Supabase(${ref})를 바라본다 — 빌드 env 오배선 (스펙 14 §4-1 매핑 표 확인)`,
    )
  }
  if (env !== 'production' && ref === PROD_REF) {
    throw new Error(
      '[envFingerprint] 비-production 빌드가 prod Supabase를 바라본다 — 빌드 env 오배선 (스펙 14 §4-1 매핑 표 확인)',
    )
  }
}
