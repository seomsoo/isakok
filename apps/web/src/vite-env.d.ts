/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // 관측 레이어 (스펙 11). 모두 optional — 미설정 시 해당 SDK는 조용히 비활성(§9).
  readonly VITE_APP_ENV?: 'development' | 'production' | 'test'
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_RELEASE?: string
  readonly VITE_POSTHOG_KEY?: string
  // E2E 테스트 빌드 전용 (스펙 13 §3-3). 'true'면 AI 가이드 background generation 차단.
  readonly VITE_DISABLE_AI_GUIDE?: string
  // RUM release_channel 속성 (스펙 13 §7). internal | production 구분.
  readonly VITE_RELEASE_CHANNEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// vite.config의 define으로 주입되는 Sentry release (init과 소스맵 업로드가 동일값을 쓰도록).
declare const __SENTRY_RELEASE__: string
