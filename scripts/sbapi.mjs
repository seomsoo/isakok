#!/usr/bin/env node
/**
 * Supabase Management API 헬퍼 (스펙 14 manual-setup 자동화용)
 *
 * .env.local의 SUPABASE_ACCESS_TOKEN(go-keyring-base64: 래핑 지원)을 읽어 호출한다.
 * 토큰이 셸 명령줄·히스토리에 노출되지 않게 하는 것이 목적.
 *
 * 사용: node scripts/sbapi.mjs <METHOD> <PATH> [JSON body]
 *   예: node scripts/sbapi.mjs GET /v1/projects
 *       node scripts/sbapi.mjs PATCH /v1/projects/<ref>/config/auth '{"site_url":"..."}'
 */
import { readFileSync } from 'node:fs'

const envLine = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n')
  .find((line) => line.startsWith('SUPABASE_ACCESS_TOKEN='))

if (!envLine) {
  console.error('SUPABASE_ACCESS_TOKEN이 .env.local에 없다')
  process.exit(1)
}

let token = envLine.slice('SUPABASE_ACCESS_TOKEN='.length).trim()
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
