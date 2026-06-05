import { defineConfig } from 'vitest/config'

// 관측 순수 로직(scrub/filterProps) 단위 테스트용. 컴포넌트/훅 테스트는 MVP 이후.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
