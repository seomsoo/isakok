#!/usr/bin/env node
/**
 * Supabase Management API 헬퍼 (스펙 14 manual-setup 자동화용)
 *
 * .env.local의 SB_MGMT_TOKEN(go-keyring-base64: 래핑 지원)을 읽어 호출한다.
 * 토큰이 셸 명령줄·히스토리에 노출되지 않게 하는 것이 목적.
 *
 * 사용: node scripts/sbapi.mjs <METHOD> <PATH> [JSON body | @파일경로]
 *   예: node scripts/sbapi.mjs GET /v1/projects
 *       node scripts/sbapi.mjs PATCH /v1/projects/<ref>/config/auth '{"site_url":"..."}'
 *
 * ⚠️ 응답을 무필터 출력한다 — `/api-keys?reveal=true`·`/config/auth`(provider secret 포함) 같은
 * 시크릿 반환 엔드포인트는 응답을 터미널/로그에 그대로 남기지 말고, jq로 비밀 아닌 필드만
 * 추출하거나 파일로 받아 사용 후 삭제할 것 (14단계 security-auditor).
 * supabase-cmd.mjs와 달리 ref 가드가 없다 — prod 경로 호출은 스스로 확인.
 */
import { readFileSync } from 'node:fs'

// SUPABASE_ACCESS_TOKEN이라는 이름은 금지 — supabase CLI가 workdir .env.local을 자동 로드해
// go-keyring 래핑 값을 그대로 Bearer로 보내며 전 명령이 401로 죽는다 (14단계 실측).
const envLine = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n')
  .find((line) => line.startsWith('SB_MGMT_TOKEN='))

if (!envLine) {
  console.error('SB_MGMT_TOKEN이 .env.local에 없다')
  process.exit(1)
}

let token = envLine.slice('SB_MGMT_TOKEN='.length).trim()
if (token.startsWith('go-keyring-base64:')) {
  token = Buffer.from(token.slice('go-keyring-base64:'.length), 'base64').toString()
}

const [method, path, bodyArg] = process.argv.slice(2)
if (!method || !path) {
  console.error('사용법: node scripts/sbapi.mjs <METHOD> <PATH> [JSON body | @파일경로]')
  process.exit(1)
}

// @파일 body — 시크릿이 명령줄·셸 히스토리에 남지 않게 파일로 전달
const body = bodyArg?.startsWith('@') ? readFileSync(bodyArg.slice(1), 'utf8') : bodyArg

const res = await fetch(`https://api.supabase.com${path}`, {
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: body || undefined,
})

console.log(`HTTP ${res.status}`)
console.log(await res.text())
// 4xx/5xx가 && 체인·set -e에서 성공으로 위장되지 않게 (verify Codex P2)
if (!res.ok) process.exitCode = 1
