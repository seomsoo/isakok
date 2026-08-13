// 허용 origin은 프로젝트별 함수 시크릿 ALLOWED_ORIGINS(콤마 구분)로 주입 (스펙 14 §5-1, ADR-109).
// fail-closed: 시크릿 미설정 시 묵시적 '*' 없음 — 아래 development 합집합 외엔 전면 403.
// ⚠️ 배포 순서: 시크릿을 먼저 설정한 뒤 이 코드를 배포할 것 — 역순이면 해당 프로젝트 CORS 전면 차단.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// 합집합 규칙: development에서만 로컬 origin 추가. LAN origin(http://192.168.x.x:5173 등)은
// 자동 허용하지 않음 — 네이티브 development 빌드용 LAN은 dev 시크릿에 명시한다 (§9-1).
if (Deno.env.get('ENVIRONMENT') === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:5173')
}

export type CorsResolved = string | null | 'DENY'

export function resolveCorsOrigin(req: Request): CorsResolved {
  const origin = req.headers.get('Origin')
  if (!origin) return null
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  return 'DENY'
}

export function makeCorsHeaders(resolved: CorsResolved): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolved && resolved !== 'DENY' ? resolved : 'null',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-debug-timing',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
