import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

// .env.test의 VITE_*를 Playwright 프로세스 env로 주입 — seed.spec.ts가 로컬 Supabase URL/KEY를
// process.env로 읽게 한다(vite build는 별도로 .env.test를 번들에 인라인). CI는 워크플로가 .env.test 생성.
Object.assign(process.env, loadEnv('test', process.cwd(), 'VITE_'))

const STORAGE = 'e2e/.auth/anon.json'
// seed.spec.ts는 setup 프로젝트 전용. 브라우저 프로젝트(chromium/webkit)는 testDir 기본 *.spec.ts
// 매칭에 이 파일이 걸려 setup 의존성과 별개로 한 번 더 실행됨(익명유저 추가 생성 + 공유 storageState
// 재기록). setup은 testMatch로 이 파일만, 브라우저는 testIgnore로 이 파일만 제외한다.
const SETUP_SPEC = /seed\.spec\.ts/

export default defineConfig({
  testDir: './e2e',
  // 공유 익명 세션 + 단일 로컬 DB를 두 플로우/양 엔진이 함께 쓰므로 직렬화(데이터 레이스 방지).
  workers: 1,
  retries: process.env.CI ? 2 : 0, // 플레이크 억제(로컬 격리로 결정성 높지만 안전망)
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173', // vite preview 기본 포트
    trace: 'on-first-retry',
  },
  webServer: {
    // VITE_*는 빌드 타임 인라인 → 반드시 build --mode test 후 preview(이미 빌드된 dist를 서빙).
    // --host 127.0.0.1: vite preview 기본은 IPv6 ::1만 바인딩 → Playwright의 127.0.0.1(IPv4)
    // 접속 실패(STATUS §106). 명시 바인딩으로 해결. --strictPort로 포트 충돌 시 조용히 안 바꾸고 실패.
    command:
      'pnpm exec vite build --mode test && pnpm exec vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // build 포함이라 넉넉히
  },
  projects: [
    { name: 'setup', testMatch: SETUP_SPEC }, // 세션 시딩
    {
      name: 'chromium',
      testIgnore: SETUP_SPEC,
      use: { ...devices['Desktop Chrome'], storageState: STORAGE },
      dependencies: ['setup'],
    },
    {
      name: 'webkit', // iOS WKWebView 기능 호환성 근사 대표 — Chromium-only가 못 잡는 iPhone 회귀
      testIgnore: SETUP_SPEC,
      use: { ...devices['Desktop Safari'], storageState: STORAGE },
      dependencies: ['setup'],
    },
  ],
})
