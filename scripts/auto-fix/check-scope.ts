#!/usr/bin/env tsx
/**
 * 거부 범위 가드 스크립트
 *
 * 정책 출처: .claude/policies/auto-fix-scope.md
 *
 * 동작: git status로 변경 파일 목록을 가져와서 거부 패턴과 매칭.
 * 거부 범위 파일이 변경되었으면 exit 1, 아니면 exit 0.
 */

import { execSync } from 'node:child_process'

const DENIED_PATH_PATTERNS = [
  // 테스트 코드 (LLM 자동 수정 차단 전용, pre-commit 포맷팅은 허용)
  /\.(test|spec)\.(ts|tsx)$/,
  /\/__tests__\//,
  /\/tests\//,
  // DB / 백엔드 핵심
  /^supabase\/migrations\//,
  /^supabase\/functions\//,
  // 인증 / 보안
  /^packages\/shared\/src\/services\/auth\//,
  /\/auth\//,
  // 환경변수
  /^\.env(\.|$)/,
  // 의존성 / 빌드 설정
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /next\.config\./,
  /vite\.config\./,
  /^tsconfig(\..*)?\.json$/,
  /tailwind\.config\./,
  // CI / 훅
  /^\.github\/workflows\//,
  /^\.husky\//,
  // 정책 자체
  /^\.claude\/policies\//,
]

const ALLOWED_OVERRIDES = [/^\.env\.example$/]

const DENIED_DIFF_PATTERNS = [
  { pattern: /-\s*expect\(/, name: 'expect() 제거' },
  { pattern: /\+\s*\.skip\(/, name: '.skip() 추가' },
  { pattern: /\+\s*\.todo\(/, name: '.todo() 추가' },
  { pattern: /\+\s*\.only\(/, name: '.only() 추가' },
  { pattern: /\+.*as\s+any\b/, name: 'as any 추가' },
  { pattern: /\+.*as\s+unknown\s+as\b/, name: 'as unknown as 추가' },
  { pattern: /\+\s*\/\/\s*@ts-ignore/, name: '@ts-ignore 추가' },
  { pattern: /\+\s*\/\/\s*@ts-expect-error/, name: '@ts-expect-error 추가' },
  { pattern: /\+.*eslint-disable/, name: 'eslint-disable 추가' },
  { pattern: /-\s*.*console\.error\(/, name: 'console.error 호출 제거' },
  { pattern: /-\s*.*logger\.error\(/, name: 'logger.error 호출 제거' },
  { pattern: /\+.*dangerouslySetInnerHTML/, name: 'dangerouslySetInnerHTML 추가' },
  { pattern: /\+.*\beval\(/, name: 'eval() 사용' },
  { pattern: /\+.*new\s+Function\(/, name: 'new Function() 사용' },
]

interface Violation {
  type: 'path' | 'pattern'
  detail: string
  file?: string
}

function getChangedFiles(): string[] {
  try {
    const stagedOutput = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
    })
    const unstagedOutput = execSync('git diff --name-only', {
      encoding: 'utf-8',
    })
    const all = [...stagedOutput.split('\n'), ...unstagedOutput.split('\n')]
    return [...new Set(all.filter(Boolean))]
  } catch {
    console.error('git diff 실행 실패')
    process.exit(2)
  }
}

function getDiffContent(): string {
  try {
    const staged = execSync('git diff --cached', { encoding: 'utf-8' })
    const unstaged = execSync('git diff', { encoding: 'utf-8' })
    return staged + '\n' + unstaged
  } catch {
    console.error('git diff 내용 조회 실패')
    process.exit(2)
  }
}

function checkPath(file: string): Violation | null {
  if (ALLOWED_OVERRIDES.some((re) => re.test(file))) return null

  for (const pattern of DENIED_PATH_PATTERNS) {
    if (pattern.test(file)) {
      return {
        type: 'path',
        file,
        detail: `거부 경로 매치: ${pattern}`,
      }
    }
  }
  return null
}

function checkDiffPatterns(diff: string): Violation[] {
  const violations: Violation[] = []
  for (const { pattern, name } of DENIED_DIFF_PATTERNS) {
    if (pattern.test(diff)) {
      violations.push({
        type: 'pattern',
        detail: name,
      })
    }
  }
  return violations
}

function main() {
  const changedFiles = getChangedFiles()
  const diff = getDiffContent()

  const violations: Violation[] = []

  for (const file of changedFiles) {
    const v = checkPath(file)
    if (v) violations.push(v)
  }

  violations.push(...checkDiffPatterns(diff))

  if (violations.length === 0) {
    console.log('✅ 거부 범위 가드 통과')
    process.exit(0)
  }

  console.error('❌ 거부 범위 위반 발견:')
  for (const v of violations) {
    if (v.type === 'path') {
      console.error(`  - 경로: ${v.file} (${v.detail})`)
    } else {
      console.error(`  - 패턴: ${v.detail}`)
    }
  }
  console.error('')
  console.error('정책: .claude/policies/auto-fix-scope.md §2')
  console.error('이 변경은 사람의 명시적 승인이 필요합니다.')
  process.exit(1)
}

main()
