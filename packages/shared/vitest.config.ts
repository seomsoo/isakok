import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      // 로직 레이어(utils/)만 래칫 대상 — constants=데이터, types=생성물이라 제외(데이터 파일
      // 추가만으로 line%가 떨어져 무고한 PR이 막히는 false-positive 방지). utils는 순수라 all:true 안전.
      provider: 'v8',
      all: true,
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/utils/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
    },
  },
})
