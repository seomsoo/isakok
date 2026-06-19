// OSS 라이선스 고지 자동 생성 (§8, ADR 없음 — 운영 체크리스트)
// apps/web + apps/mobile + packages/shared의 production dependencies(devDependencies 제외)를 모아
// 각 패키지의 license/version + LICENSE 전문을 node_modules에서 읽어 apps/web/src/data/ossLicenses.ts 로 출력.
// 전문(text)을 함께 싣는 이유: MIT/ISC 등은 저작권·허가 고지문을 배포물에 포함해야 함 (라벨만으론 불완전).
// 재생성: node scripts/gen-oss-licenses.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const PKG_PATHS = [
  'apps/web/package.json',
  'apps/mobile/package.json',
  'packages/shared/package.json',
]

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

function licenseOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license
  if (pkg.license && typeof pkg.license === 'object' && pkg.license.type) return pkg.license.type
  if (Array.isArray(pkg.licenses) && pkg.licenses[0]?.type) return pkg.licenses[0].type
  return 'UNKNOWN'
}

// 패키지 폴더에서 LICENSE 전문을 찾아 읽는다. 파일명 관례가 제각각이라 후보를 순회 + 대소문자 무시 매칭.
function licenseTextOf(pkgDir) {
  const KNOWN = [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'LICENCE',
    'LICENCE.md',
    'LICENCE.txt',
    'LICENSE-MIT',
    'LICENSE-MIT.txt',
    'COPYING',
  ]
  for (const f of KNOWN) {
    const p = join(pkgDir, f)
    if (existsSync(p)) {
      const t = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').trim()
      if (t) return t
    }
  }
  // 관례 밖 파일명(예: license.markdown) 대비 — 디렉터리에서 license*로 시작하는 첫 파일.
  try {
    const hit = readdirSync(pkgDir).find((f) => /^licen[sc]e/i.test(f))
    if (hit) {
      const t = readFileSync(join(pkgDir, hit), 'utf8').replace(/\r\n/g, '\n').trim()
      if (t) return t
    }
  } catch {
    // 디렉터리 읽기 실패 시 무시 (합성 또는 빈 문자열로 폴백)
  }
  return ''
}

// 일부 패키지(특히 Expo 계열)는 package.json에 license만 선언하고 LICENSE 파일을 npm에 싣지 않는다.
// 이 경우 SPDX 표준 문안에 저작권자를 채워 합성한다 (license-checker 등도 쓰는 관행).
function authorOf(pkg) {
  if (typeof pkg.author === 'string') return pkg.author.replace(/\s*<[^>]*>/, '').trim()
  if (pkg.author && typeof pkg.author === 'object' && pkg.author.name) return pkg.author.name
  return ''
}

function synthesizeLicense(license, holder) {
  const who = holder || 'the package authors'
  if (license === 'MIT') {
    return `MIT License

Copyright (c) ${who}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
  }
  if (license === 'ISC') {
    return `ISC License

Copyright (c) ${who}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`
  }
  return ''
}

const names = new Set()
for (const rel of PKG_PATHS) {
  const pkg = readJson(join(root, rel))
  for (const name of Object.keys(pkg.dependencies ?? {})) {
    if (name.startsWith('@moving/')) continue // 워크스페이스 내부 패키지 제외
    names.add(name)
  }
}

const entries = []
let synthesizedCount = 0
let missingText = 0
for (const name of [...names].sort()) {
  const pkgDir = join(root, 'node_modules', name)
  const pkgPath = join(pkgDir, 'package.json')
  if (!existsSync(pkgPath)) {
    entries.push({ name, version: 'unknown', license: 'UNKNOWN', text: '', synthesized: false })
    missingText++
    continue
  }
  const pkg = readJson(pkgPath)
  const license = licenseOf(pkg)
  let text = licenseTextOf(pkgDir)
  let synthesized = false
  if (!text) {
    text = synthesizeLicense(license, authorOf(pkg))
    if (text) {
      synthesized = true
      synthesizedCount++
    } else {
      missingText++
    }
  }
  entries.push({ name, version: pkg.version ?? 'unknown', license, text, synthesized })
}

const content = `// 자동 생성 — scripts/gen-oss-licenses.mjs. 직접 수정하지 마세요.
// apps/web + apps/mobile + packages/shared의 production 의존성 (devDependencies 제외).
// text: LICENSE 파일 전문. 파일이 없으면 SPDX 표준 문안을 저작권자로 합성(synthesized=true).

export interface OssLicense {
  name: string
  version: string
  license: string
  text: string
  /** LICENSE 파일이 없어 SPDX 표준 문안으로 합성한 경우 true */
  synthesized: boolean
}

export const OSS_LICENSES: OssLicense[] = ${JSON.stringify(entries, null, 2)}
`

const dest = join(root, 'apps/web/src/data/ossLicenses.ts')
mkdirSync(dirname(dest), { recursive: true })
writeFileSync(dest, content)
console.log(
  `Wrote ${entries.length} OSS license entries to ${dest} ` +
    `(파일 전문 ${entries.length - synthesizedCount - missingText}건 · 합성 ${synthesizedCount}건 · 누락 ${missingText}건)`,
)
