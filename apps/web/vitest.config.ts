import { defineConfig } from 'vitest/config'

// 관측 + 순수 로직 단위 테스트용. 컴포넌트/훅 테스트는 MVP 이후.
// coverage.all=false 이유: lib/supabase 등 모듈 로드 시점에 import.meta.env(테스트엔 없음)를
// 읽어 createClient가 throw하는 부수효과 파일을 강제 로드하지 않기 위함. 테스트가 실제 import한
// 순수 모듈만 집계한다. UI(.tsx)·서비스 통합 동작은 E2E(13단계 §5)가 검증.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      all: false,
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'src/types/**'],
    },
  },
})
