const ALLOWED_ORIGINS = ['https://isakok-dev.vercel.app', 'https://isakok.vercel.app']

if (Deno.env.get('ENVIRONMENT') !== 'production') {
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
