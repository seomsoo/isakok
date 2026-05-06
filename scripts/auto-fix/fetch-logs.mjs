#!/usr/bin/env node
/**
 * 실패한 CI 워크플로우의 로그를 GitHub API로 다운로드.
 * 토큰 절약을 위해 실패한 step의 로그만 추출.
 *
 * v2: maxBuffer(50MB)와 출력 한도(5MB)를 분리.
 * raw 버퍼는 충분히 크게, 출력은 5MB로 제한.
 */

import { execSync } from 'node:child_process'

const RUN_ID = process.env.RUN_ID
const GH_TOKEN = process.env.GH_TOKEN

const RAW_MAX_BUFFER = 50 * 1024 * 1024
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024
const TRUNCATE_BYTES = 1 * 1024 * 1024

if (!RUN_ID || !GH_TOKEN) {
  console.error('RUN_ID, GH_TOKEN 환경변수 필요')
  process.exit(1)
}

const result = execSync(`gh run view ${RUN_ID} --log-failed`, {
  encoding: 'utf-8',
  env: { ...process.env, GH_TOKEN },
  maxBuffer: RAW_MAX_BUFFER,
})

let output = result

if (Buffer.byteLength(output) > MAX_OUTPUT_BYTES) {
  const head = output.slice(0, TRUNCATE_BYTES)
  const tail = output.slice(-TRUNCATE_BYTES)
  output = `${head}\n\n... [중간 트렁케이트됨, 원본 ${Buffer.byteLength(result)} bytes] ...\n\n${tail}`
}

process.stdout.write(output)
