// OSS 라이선스 고지 자동 생성 (§8, ADR 없음 — 운영 체크리스트)
// apps/web + apps/mobile + packages/shared의 production dependencies(devDependencies 제외)를 모아
// 각 패키지의 license/version을 node_modules에서 읽어 apps/web/src/data/ossLicenses.ts 로 출력.
// 재생성: node scripts/gen-oss-licenses.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
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

const names = new Set()
for (const rel of PKG_PATHS) {
  const pkg = readJson(join(root, rel))
  for (const name of Object.keys(pkg.dependencies ?? {})) {
    if (name.startsWith('@moving/')) continue // 워크스페이스 내부 패키지 제외
    names.add(name)
  }
}

const entries = []
for (const name of [...names].sort()) {
  const pkgPath = join(root, 'node_modules', name, 'package.json')
  if (!existsSync(pkgPath)) {
    entries.push({ name, version: 'unknown', license: 'UNKNOWN' })
    continue
  }
  const pkg = readJson(pkgPath)
  entries.push({ name, version: pkg.version ?? 'unknown', license: licenseOf(pkg) })
}

const body = entries
  .map((e) => `  { name: ${JSON.stringify(e.name)}, version: ${JSON.stringify(e.version)}, license: ${JSON.stringify(e.license)} },`)
  .join('\n')

const content = `// 자동 생성 — scripts/gen-oss-licenses.mjs. 직접 수정하지 마세요.
// apps/web + apps/mobile + packages/shared의 production 의존성 (devDependencies 제외).

export interface OssLicense {
  name: string
  version: string
  license: string
}

export const OSS_LICENSES: OssLicense[] = [
${body}
]
`

const dest = join(root, 'apps/web/src/data/ossLicenses.ts')
mkdirSync(dirname(dest), { recursive: true })
writeFileSync(dest, content)
console.log(`Wrote ${entries.length} OSS license entries to ${dest}`)
