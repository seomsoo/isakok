#!/usr/bin/env node
/**
 * 일일 토큰 사용량 best-effort 관측 도구.
 *
 * 이는 hard limit이 아니라 best-effort 관측치다.
 * GitHub Actions runner는 매번 새 환경이라 파일 누적이 보장되지 않는다.
 * 실제 비용 hard limit은 Anthropic Console의 월 예산 알림/제한으로 관리한다.
 *
 * --check: 누적 파일이 있으면 검사, 없으면 통과 (best-effort)
 * --record <input> <output>: 사용량 기록 (run.mjs가 호출)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '100000', 10)
const LOG_DIR = 'docs/auto-fix-log'
const today = new Date().toISOString().slice(0, 10)
const budgetFile = join(LOG_DIR, `budget-${today}.json`)

function readBudget() {
  if (!existsSync(budgetFile)) {
    return { date: today, inputTokens: 0, outputTokens: 0, calls: 0 }
  }
  try {
    return JSON.parse(readFileSync(budgetFile, 'utf-8'))
  } catch {
    return { date: today, inputTokens: 0, outputTokens: 0, calls: 0 }
  }
}

function writeBudget(budget) {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
  writeFileSync(budgetFile, JSON.stringify(budget, null, 2))
}

const args = process.argv.slice(2)
const command = args[0]

if (command === '--check') {
  const budget = readBudget()
  console.log(
    `[best-effort] 오늘 관측: input=${budget.inputTokens}, output=${budget.outputTokens}, calls=${budget.calls}`,
  )
  console.log(`일일 입력 한도(관측치 기준): ${DAILY_LIMIT}`)

  if (budget.inputTokens >= DAILY_LIMIT) {
    console.error(`⚠️ 관측치 기준 일일 한도 초과 (${budget.inputTokens} >= ${DAILY_LIMIT})`)
    console.error(
      '   주의: best-effort라서 실제 사용량은 더 클 수 있음. Anthropic Console 확인 권장.',
    )
    process.exit(1)
  }
  console.log('✅ 관측치 기준 한도 내')
  process.exit(0)
}

if (command === '--record') {
  const input = parseInt(args[1] || '0', 10)
  const output = parseInt(args[2] || '0', 10)
  const budget = readBudget()
  budget.inputTokens += input
  budget.outputTokens += output
  budget.calls += 1

  try {
    writeBudget(budget)
    console.log(
      `기록(best-effort): +input=${input}, +output=${output}, total calls=${budget.calls}`,
    )
  } catch (e) {
    console.error(`[WARN] budget 기록 실패 (best-effort, 무시): ${e.message}`)
  }
  process.exit(0)
}

console.error('Usage: budget-guard.mjs --check | --record <input> <output>')
process.exit(2)
