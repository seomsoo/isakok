#!/usr/bin/env node
/**
 * Supabase 원격 명령 가드 wrapper (스펙 14 §5-2, ADR-109)
 *
 * 원칙:
 * 1. linked 상태는 편의일 뿐 안전 경계가 아니다 — 모든 원격 명령은 대상 ref를 아래 상수와 대조한다.
 * 2. prod는 link하지 않는다 — prod 함수 배포는 ref를 인자로 직접 타이핑, prod DB는 일시적
 *    PROD_DB_URL 주입(read -s, 파일 저장 금지)으로만.
 * 3. prod에는 통합 명령이 없다 — DB push와 함수 배포는 의도적으로 별도 실행 (함수 핫픽스가
 *    대기 중 마이그레이션을 prod에 끌고 가는 사고를 구조적으로 차단).
 *
 * `supabase db reset --linked` 직접 실행 금지 — 반드시 `pnpm db:reset:dev`로.
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

const DEV_REF = 'yiffgoxnyyngkbasyfaw' // isakok-dev
const PROD_REF = 'ybcqinanfcarhqkclvue' // isakok-prod — 실사용자 데이터

function fail(message) {
  console.error(`[supabase-cmd] ${message}`)
  process.exit(1)
}

function linkedRef() {
  try {
    return readFileSync(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8').trim()
  } catch {
    return null
  }
}

function run(args) {
  const result = spawnSync('npx', ['supabase', ...args], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function assertLinkedDev() {
  const ref = linkedRef()
  if (ref === PROD_REF) {
    fail('linked가 prod다 — 즉시 중단. dev로 되돌려라: supabase link --project-ref ' + DEV_REF)
  }
  if (ref !== DEV_REF) {
    fail(`linked ref(${ref ?? '없음'})가 dev가 아니다 — supabase link --project-ref ${DEV_REF} 후 재실행`)
  }
}

function deployFunctions(ref) {
  run(['functions', 'deploy', '--project-ref', ref])
  // cleanup은 config.toml에 verify_jwt 미선언 — 배포 시 --no-verify-jwt 필수 (ADR-076)
  run(['functions', 'deploy', 'cleanup', '--no-verify-jwt', '--project-ref', ref])
}

/** prod ref는 에러 메시지에 노출하지 않는다 — 의도적 타이핑이 가드의 핵심 마찰이다. */
function assertProdRefArg(refArg) {
  if (!refArg) fail('prod ref를 인자로 직접 타이핑해야 한다 (스펙 14 §5-2). 예: pnpm functions:deploy:prod -- <prod-ref>')
  if (refArg !== PROD_REF) fail('인자 ref가 기대하는 PROD_REF와 불일치 — 대상 확인 후 재실행')
}

const [command, refArg] = process.argv.slice(2)

switch (command) {
  case 'db:push:dev':
    assertLinkedDev()
    run(['db', 'push'])
    break

  case 'functions:deploy:dev':
    assertLinkedDev()
    deployFunctions(DEV_REF)
    break

  case 'deploy:dev':
    assertLinkedDev()
    run(['db', 'push'])
    deployFunctions(DEV_REF)
    break

  case 'db:reset:dev': {
    const ref = linkedRef()
    if (ref === PROD_REF) fail('linked가 prod다 — reset 무조건 거부')
    if (ref !== DEV_REF) fail(`linked ref(${ref ?? '없음'})가 dev가 아니다 — reset 거부`)
    // 리셋 후 config.toml seed 경로(supabase/seed.sql)로 자동 재시딩
    run(['db', 'reset', '--linked'])
    break
  }

  case 'functions:deploy:prod':
    assertProdRefArg(refArg)
    deployFunctions(PROD_REF)
    break

  case 'db:push:prod': {
    // 이번 스펙(14) 사용처 없음 — 향후 단계용. prod 스키마 변경은 dry-run + 명시 확인 필수.
    assertProdRefArg(refArg)
    const dbUrl = process.env.PROD_DB_URL
    if (!dbUrl) {
      fail('PROD_DB_URL 필요 — read -s PROD_DB_URL && export PROD_DB_URL 로 일시 주입(파일 저장 금지)')
    }
    if (!dbUrl.includes(PROD_REF)) fail('PROD_DB_URL이 prod ref를 포함하지 않는다 — 대상 불일치')
    run(['db', 'push', '--dry-run', '--db-url', dbUrl])
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await rl.question('위 dry-run 목록을 prod에 적용할까? (yes 입력 시 실행): ')
    rl.close()
    if (answer.trim() !== 'yes') fail('중단')
    run(['db', 'push', '--db-url', dbUrl])
    break
  }

  default:
    fail(
      `알 수 없는 명령: ${command ?? '(없음)'}\n` +
        '사용 가능: db:push:dev | functions:deploy:dev | deploy:dev | db:reset:dev | functions:deploy:prod -- <ref> | db:push:prod -- <ref>',
    )
}
