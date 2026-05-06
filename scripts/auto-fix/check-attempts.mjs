#!/usr/bin/env node
/**
 * 같은 브랜치에 봇 PR이 몇 번 만들어졌는지 확인.
 * 최대 시도 횟수 초과 시 exit 1로 워크플로우 중단.
 */

import { execFileSync } from 'node:child_process'

const BRANCH = process.env.BRANCH
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || '3', 10)
const GH_TOKEN = process.env.GH_TOKEN

if (!BRANCH || !GH_TOKEN) {
  console.error('BRANCH, GH_TOKEN 환경변수 필요')
  process.exit(2)
}

const result = execFileSync(
  'gh',
  ['pr', 'list', '--base', BRANCH, '--label', 'auto-fix', '--state', 'all', '--json', 'number,createdAt', '--limit', '100'],
  {
    encoding: 'utf-8',
    env: { ...process.env, GH_TOKEN },
  },
)

const prs = JSON.parse(result)

const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
const recentAttempts = prs.filter((pr) => new Date(pr.createdAt) > since)

console.log(`최근 24시간 봇 시도: ${recentAttempts.length} / ${MAX_ATTEMPTS}`)

if (recentAttempts.length >= MAX_ATTEMPTS) {
  console.error(`❌ 시도 한도 초과 (${recentAttempts.length}회). 사람 개입 필요.`)
  process.exit(1)
}

console.log('✅ 시도 한도 내 — 진행 가능')
