#!/usr/bin/env node
/**
 * 커버리지 래칫 (회귀 금지) — ADR-103.
 *
 * 절대 % 목표가 아니라 "한 번 덮은 건 다시 벗기지 마라"만 강제한다.
 * package별 coverage-summary.json(turbo가 위치 분산)을 docs/coverage-baseline.json과 비교해
 * 현재 < (baseline - 허용오차) 이면 exit 1.
 *
 * 사용: pnpm test:coverage && node scripts/coverage-ratchet.mjs
 * baseline 상승은 사람이 의도적으로 커밋 (자동 상승 금지 — 우연한 상승이 천장이 되어 후속 PR을 막는 것 방지).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TOLERANCE = 0.1 // %p — 도구/반올림 미세 변동은 회귀로 보지 않음
const METRICS = ['lines', 'functions', 'statements', 'branches']
const PACKAGES = {
  'apps/web': 'apps/web/coverage/coverage-summary.json',
  'packages/shared': 'packages/shared/coverage/coverage-summary.json',
}

const baseline = JSON.parse(readFileSync(resolve('docs/coverage-baseline.json'), 'utf8'))

let failed = false
for (const [pkg, summaryPath] of Object.entries(PACKAGES)) {
  let summary
  try {
    summary = JSON.parse(readFileSync(resolve(summaryPath), 'utf8'))
  } catch {
    console.error(`✗ ${pkg}: coverage-summary.json 없음 (${summaryPath}) — pnpm test:coverage 먼저 실행`)
    failed = true
    continue
  }
  const current = summary.total
  const base = baseline[pkg]
  if (!base) {
    console.error(`✗ ${pkg}: baseline 항목 없음 — docs/coverage-baseline.json 확인`)
    failed = true
    continue
  }
  for (const metric of METRICS) {
    const cur = current[metric].pct
    const prev = base[metric]
    if (cur < prev - TOLERANCE) {
      console.error(`✗ ${pkg} ${metric}: ${cur}% < baseline ${prev}% (회귀)`)
      failed = true
    } else {
      const up = cur > prev + TOLERANCE ? '  ↑ baseline 갱신 후보' : ''
      console.log(`✓ ${pkg} ${metric}: ${cur}% (baseline ${prev}%)${up}`)
    }
  }
}

if (failed) {
  console.error('\n커버리지 래칫 실패 — 테스트를 지웠거나 커버리지가 baseline 아래로 하락했습니다.')
  process.exit(1)
}
console.log('\n커버리지 래칫 통과.')
