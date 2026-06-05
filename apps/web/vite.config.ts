import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

// Sentry 소스맵 업로드 (스펙 11 §1-2): SENTRY_AUTH_TOKEN이 있을 때만 활성.
// 그때만 소스맵을 생성→업로드→삭제하므로 산출물(dist)에 .map이 남지 않는다.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
// 소스맵 업로드는 token·org·project 3개가 모두 있을 때만 활성. 일부만 설정된 환경(예: preview에
// 토큰만 있는 경우)에선 플러그인이 실패하지 않고 조용히 스킵 — 빌드 깨짐 방어.
const enableSentryUpload = Boolean(
  sentryAuthToken && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
)

// init(sentry.ts)과 upload가 동일 release를 쓰도록 한 곳에서 계산 (§1-2 release 일치 규칙).
// 형식 고정: isakok-web@<sha>. Vercel은 VERCEL_GIT_COMMIT_SHA를 제공.
const gitSha = process.env.VERCEL_GIT_COMMIT_SHA
const sentryRelease = process.env.VITE_SENTRY_RELEASE || (gitSha ? `isakok-web@${gitSha}` : '')

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 소스맵 플러그인은 마지막에 — 최종 산출물 기준으로 동작
    ...(enableSentryUpload
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: sentryAuthToken,
            release: { name: sentryRelease || undefined },
            sourcemaps: {
              // 업로드 후 산출물에서 .map 제거 — 소스맵 공개 방지(§1-2)
              filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
            telemetry: false,
          }),
        ]
      : []),
  ],
  build: {
    // 업로드할 때만 소스맵 생성(업로드 후 삭제). 미업로드 빌드엔 소스맵 없음.
    sourcemap: enableSentryUpload,
  },
  define: {
    // init이 읽는 release를 plugin과 동일값으로 주입
    __SENTRY_RELEASE__: JSON.stringify(sentryRelease),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
})
