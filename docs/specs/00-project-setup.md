# 0단계: 프로젝트 세팅 스펙 (SDD)

> 목표: Turborepo 모노레포 + React Vite 웹앱 + 공유 패키지 초기 세팅
> 이 단계가 끝나면: `pnpm dev` 한 번에 웹앱이 뜨고, 타입/린트/포맷팅이 동작하는 상태

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- Turborepo 모노레포 구조 생성
- apps/web (React + Vite + TypeScript) 프로젝트 초기화
- packages/shared 패키지 초기화 (빈 폴더 구조 + 타입 내보내기)
- Tailwind CSS v4 설정 (디자인 토큰 반영)
- ESLint + Prettier 설정
- Vitest 설정
- 경로 별칭 (@shared/, @/)
- Git 초기화 + .gitignore
- 루트/하위 CLAUDE.md 배치
- 기획 문서(docs/) 배치

### 하는 것 (v2 추가: 하네스 세팅)

- Claude Code 커스텀 커맨드 2개 (verify, handoff)
- Claude Code 서브에이전트 1개 (spec-reviewer)
- 진행 상태 문서 (docs/STATUS.md)

### 안 하는 것

- Supabase 연동 (1단계)
- 라우팅, 페이지 구현 (2단계~)
- apps/mobile (9단계)
- CI/CD 파이프라인 (6단계 배포 시)
- 환경변수 .env 파일 (1단계에서 Supabase 세팅할 때)

---

## 1. 모노레포 구조

```
isakok/                    ← 프로젝트 루트
├── package.json                   ← 워크스페이스 정의 + 공통 스크립트
├── pnpm-workspace.yaml            ← pnpm 워크스페이스 설정
├── turbo.json                     ← Turborepo 파이프라인 설정
├── .gitignore
├── .prettierrc
├── .prettierignore
├── CLAUDE.md                      ← 루트 CLAUDE.md
│
├── .claude/                       ← Claude Code 하네스 (v2 추가)
│   ├── commands/
│   │   ├── verify.md              ← 단계 완료 후 검증 커맨드
│   │   └── handoff.md             ← 세션 종료 시 상태 저장 커맨드
│   └── agents/
│       └── spec-reviewer.md       ← 스펙 vs 구현 비교 서브에이전트
│
├── apps/
│   └── web/                       ← React Vite 웹앱
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.app.json
│       ├── tsconfig.node.json
│       ├── vite.config.ts
│       ├── tailwind.config.ts     ← 또는 CSS 기반 v4 설정
│       ├── eslint.config.js       ← flat config
│       ├── index.html
│       ├── CLAUDE.md              ← 웹앱 전용 규칙
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── index.css           ← Tailwind 진입점 + 디자인 토큰
│           ├── pages/              ← (빈 폴더, 2단계~)
│           ├── features/           ← (빈 폴더, 2단계~)
│           │   ├── onboarding/
│           │   │   ├── components/ ← .gitkeep
│           │   │   └── hooks/      ← .gitkeep
│           │   ├── dashboard/
│           │   │   ├── components/
│           │   │   └── hooks/
│           │   ├── timeline/
│           │   │   ├── components/
│           │   │   └── hooks/
│           │   ├── checklist/
│           │   │   ├── components/
│           │   │   └── hooks/
│           │   ├── photos/
│           │   │   ├── components/
│           │   │   └── hooks/
│           │   └── settings/
│           │       ├── components/
│           │       └── hooks/
│           ├── shared/
│           │   └── components/     ← DevTabBar, Spinner, ErrorMessage (빈 폴더)
│           ├── stores/             ← Zustand (빈 폴더)
│           └── lib/                ← supabase.ts 등 (빈 폴더)
│
├── packages/
│   └── shared/                    ← 앱 간 공유 코드
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── CLAUDE.md              ← 공유 패키지 규칙
│       └── src/
│           ├── index.ts            ← 패키지 진입점
│           ├── services/           ← .gitkeep (1단계~)
│           ├── utils/              ← .gitkeep (2단계~)
│           ├── types/              ← 타입 정의 (이 단계에서 시작)
│           │   ├── move.ts
│           │   ├── checklist.ts
│           │   ├── photo.ts
│           │   └── common.ts
│           └── constants/          ← 상수 (이 단계에서 시작)
│               ├── colors.ts
│               └── routes.ts
│
├── supabase/                      ← (1단계에서 생성)
│   └── CLAUDE.md
│
└── docs/                          ← 기획 문서 + 단계별 스펙
    ├── CLAUDE.md
    ├── STATUS.md                  ← 현재 진행 상태 (handoff가 업데이트)
    ├── 이사일정관리_기획정리.md
    ├── 설계_결정사항_통합_v2.md
    ├── 마스터_체크리스트_데이터.md
    └── specs/
        └── 00-project-setup.md    ← 이 파일
```

---

## 2. 파일별 상세 스펙

### 2-1. 루트 설정 파일

#### package.json (루트)

```jsonc
{
  "name": "isakok",
  "private": true,
  "packageManager": "pnpm@9.x", // pnpm 버전 고정
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "turbo test",
    "clean": "turbo clean",
  },
  "devDependencies": {
    "turbo": "^2.x",
    "prettier": "^3.x",
  },
}
```

#### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

#### turbo.json

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true,
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
    },
    "lint": {
      "dependsOn": ["^build"],
    },
    "test": {
      "cache": false,
    },
    "clean": {
      "cache": false,
    },
  },
}
```

#### .gitignore

```
node_modules/
dist/
.turbo/
.env
.env.*
!.env.example
*.local
.DS_Store
coverage/
```

#### .prettierrc

```jsonc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
}
```

#### .prettierignore

```
node_modules
dist
.turbo
pnpm-lock.yaml
coverage
```

---

### 2-2. apps/web 설정 파일

#### apps/web/package.json

```jsonc
{
  "name": "@moving/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "clean": "rm -rf dist node_modules .turbo",
  },
  "dependencies": {
    "react": "^19.x",
    "react-dom": "^19.x",
    "@moving/shared": "workspace:*",
  },
  "devDependencies": {
    "@types/react": "^19.x",
    "@types/react-dom": "^19.x",
    "@vitejs/plugin-react": "^4.x",
    "typescript": "^5.x",
    "vite": "^6.x",
    "tailwindcss": "^4.x",
    "@tailwindcss/vite": "^4.x",
    "eslint": "^9.x",
    "@eslint/js": "latest",
    "typescript-eslint": "^8.x",
    "eslint-plugin-react-hooks": "^5.x",
    "globals": "^15.x",
  },
}
```

> **Tailwind CSS v4 참고**: v4는 설정 방식이 바뀌었다. `tailwind.config.ts` 대신 CSS 파일 안에서 `@theme` 블록으로 토큰을 정의한다. 별도의 PostCSS 설정도 불필요 — `@tailwindcss/vite` 플러그인이 전부 처리한다.

#### apps/web/vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
})
```

#### apps/web/tsconfig.json

```jsonc
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }],
}
```

#### apps/web/tsconfig.app.json

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Strict */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    /* 경로 별칭 */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../../packages/shared/src/*"],
    },
  },
  "include": ["src"],
}
```

#### apps/web/tsconfig.node.json

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
  },
  "include": ["vite.config.ts"],
}
```

#### apps/web/eslint.config.js

```javascript
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
```

#### apps/web/index.html

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>이사 매니저</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### 2-3. apps/web/src 소스 파일

#### src/index.css — Tailwind 진입점 + 디자인 토큰

```css
@import 'tailwindcss';

/*
 * 디자인 토큰 (설계 결정사항 통합 v2 §2-3 기반)
 * Tailwind v4에서는 @theme 블록으로 커스텀 토큰을 정의한다.
 * 사용: className="bg-primary text-neutral" 또는 CSS에서 var(--color-primary)
 */
@theme {
  --color-primary: #0f766e;
  --color-secondary: #333344;
  --color-tertiary: #e0f2f1;
  --color-neutral: #f8f7f5;
  --color-warning: #f97316;
  --color-critical: #ef4444;
  --color-success: #10b981;
}

/*
 * 모바일 WebView 앱 기준 레이아웃
 * max-width: 430px → iPad에서 가운데 정렬
 * 데스크톱 레이아웃 불필요 (WebView 전용)
 */
#root {
  max-width: 430px;
  margin: 0 auto;
  min-height: 100dvh;
  background-color: var(--color-neutral);
}
```

> **왜 `100dvh`?**: `100vh`는 모바일 브라우저에서 주소창 높이 때문에 스크롤이 생긴다. `dvh`(dynamic viewport height)는 주소창 상태에 따라 동적으로 조절되어 모바일에서 정확한 전체 높이를 잡는다. WebView 앱이라 이 이슈가 직접 해당되진 않지만, 개발 중 브라우저에서 테스트할 때 유용하다.

#### src/main.tsx

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import '@/index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found. Check index.html for <div id="root">')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

#### src/App.tsx

```typescript
export function App() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold text-secondary">이사 매니저</h1>
      <p className="mt-2 text-secondary/60">0단계 세팅 완료</p>
      <div className="mt-6 flex gap-3">
        <span className="rounded-full bg-primary px-3 py-1 text-sm text-white">Primary</span>
        <span className="rounded-full bg-warning px-3 py-1 text-sm text-white">Warning</span>
        <span className="rounded-full bg-critical px-3 py-1 text-sm text-white">Critical</span>
        <span className="rounded-full bg-success px-3 py-1 text-sm text-white">Success</span>
      </div>
    </div>
  )
}
```

> 이 App.tsx는 세팅 확인용 — 디자인 토큰 4색이 원에 표시되면 Tailwind 설정이 올바른 것. 2단계 온보딩 구현 시 교체한다.

---

### 2-4. packages/shared

#### packages/shared/package.json

```jsonc
{
  "name": "@moving/shared",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "echo 'shared lint placeholder'",
    "clean": "rm -rf node_modules .turbo",
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vitest": "^3.x",
  },
}
```

> **왜 빌드 스텝이 없나?**: Vite는 packages/shared/src를 직접 트랜스파일한다 (경로 별칭으로 소스를 직접 가리키니까). 빌드 파이프라인 없이 import만 하면 된다. 배포 시 Vite가 번들에 포함시킨다. 이 방식은 1인 개발 모노레포에서 가장 간단하다.

#### packages/shared/tsconfig.json

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": {},
  },
  "include": ["src"],
}
```

#### packages/shared/vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

#### packages/shared/src/index.ts

```typescript
// 타입
export type { HousingType, ContractType, MoveType } from './types/move'
export type { MoveStatus } from './types/move'
export type { GuideType, CategoryType } from './types/checklist'
export type { RoomType, PhotoType } from './types/photo'

// 상수
export { COLORS } from './constants/colors'
export { ROUTES } from './constants/routes'
```

---

### 2-5. packages/shared/src/types — 타입 정의

> DB 스키마 기반으로 프론트엔드 타입을 미리 정의한다. Supabase CLI로 자동 생성하는 `database.ts`는 1단계에서 추가.

#### types/move.ts

```typescript
/**
 * 주거 유형 (온보딩 Step 2)
 * DB: moves.housing_type CHECK 제약조건
 */
export const HOUSING_TYPES = {
  원룸: '원룸',
  오피스텔: '오피스텔',
  빌라: '빌라',
  아파트: '아파트',
  '투룸+': '투룸+',
} as const

export type HousingType = (typeof HOUSING_TYPES)[keyof typeof HOUSING_TYPES]

/**
 * 계약 유형 (온보딩 Step 3)
 * DB: moves.contract_type CHECK 제약조건
 */
export const CONTRACT_TYPES = {
  월세: '월세',
  전세: '전세',
} as const

export type ContractType = (typeof CONTRACT_TYPES)[keyof typeof CONTRACT_TYPES]

/**
 * 이사 방식 (온보딩 Step 4에서 선택 or 체크리스트 필터용)
 * DB: moves.move_type CHECK 제약조건
 */
export const MOVE_TYPES = {
  용달: '용달',
  반포장: '반포장',
  포장: '포장',
  자가용: '자가용',
} as const

export type MoveType = (typeof MOVE_TYPES)[keyof typeof MOVE_TYPES]

/**
 * 이사 상태
 * DB: moves.status CHECK 제약조건
 */
export const MOVE_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type MoveStatus = (typeof MOVE_STATUSES)[keyof typeof MOVE_STATUSES]
```

#### types/checklist.ts

```typescript
/**
 * 가이드 유형 (항목 중요도)
 * DB: master_checklist_items.guide_type CHECK 제약조건
 * UI: critical=빨강 뱃지, warning=앰버 뱃지, tip=틸 뱃지
 */
export const GUIDE_TYPES = {
  TIP: 'tip',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const

export type GuideType = (typeof GUIDE_TYPES)[keyof typeof GUIDE_TYPES]

/**
 * 체크리스트 카테고리
 * DB: master_checklist_items.category
 * UI: 항목 상세 화면에서 카테고리 태그로 표시
 */
export const CATEGORIES = {
  업체_이사방법: '업체/이사방법',
  정리_폐기: '정리/폐기',
  행정_서류: '행정/서류',
  공과금_정산: '공과금/정산',
  통신_구독: '통신/구독',
  짐싸기_포장: '짐싸기/포장',
  집상태기록: '집상태기록',
  이사당일: '이사당일',
  입주후: '입주후',
} as const

export type CategoryType = (typeof CATEGORIES)[keyof typeof CATEGORIES]
```

#### types/photo.ts

```typescript
/**
 * 사진 유형 (입주/퇴실)
 * DB: property_photos.photo_type CHECK 제약조건
 */
export const PHOTO_TYPES = {
  MOVE_IN: 'move_in',
  MOVE_OUT: 'move_out',
} as const

export type PhotoType = (typeof PHOTO_TYPES)[keyof typeof PHOTO_TYPES]

/**
 * 방 목록 (6개 고정)
 * DB: property_photos.room CHECK 제약조건
 * "기타" 선택 시 location_detail 컬럼에 자유 입력
 */
export const ROOMS = {
  ENTRANCE: 'entrance',
  ROOM: 'room',
  BATHROOM: 'bathroom',
  KITCHEN: 'kitchen',
  BALCONY: 'balcony',
  OTHER: 'other',
} as const

export type RoomType = (typeof ROOMS)[keyof typeof ROOMS]

/**
 * 방 한글 라벨 (UI 표시용)
 */
export const ROOM_LABELS: Record<RoomType, string> = {
  entrance: '현관',
  room: '방',
  bathroom: '화장실',
  kitchen: '주방',
  balcony: '베란다',
  other: '기타',
} as const
```

#### types/common.ts

```typescript
/**
 * Supabase 자동 생성 필드 (모든 테이블 공통)
 * DB 응답에는 포함, 생성 요청에는 제외
 */
export interface TimestampFields {
  created_at: string
  updated_at: string
}

/**
 * soft delete 가능 테이블 공통 (moves, property_photos)
 */
export interface SoftDeletable {
  deleted_at: string | null
}
```

---

### 2-6. packages/shared/src/constants — 상수

#### constants/colors.ts

```typescript
/**
 * 디자인 토큰 (설계 결정사항 통합 v2 §2-3)
 * Tailwind는 CSS @theme에서 관리하지만,
 * JS에서 동적으로 색상이 필요한 경우 (차트, 아이콘 등) 이 상수를 사용
 */
export const COLORS = {
  primary: '#0F766E',
  secondary: '#333344',
  tertiary: '#E0F2F1',
  neutral: '#F8F7F5',
  warning: '#F97316',
  critical: '#EF4444',
  success: '#10B981',
} as const
```

#### constants/routes.ts

```typescript
/**
 * 앱 내 라우트 경로
 * 매직 문자열 방지용. 라우터 설정 + 네비게이션에서 공유.
 */
export const ROUTES = {
  LANDING: '/',
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  TIMELINE: '/timeline',
  CHECKLIST_DETAIL: '/checklist/:itemId',
  PHOTOS: '/photos',
  PHOTO_RECORD: '/photos/record',
  PHOTO_REPORT: '/photos/report',
  SETTINGS: '/settings',
} as const
```

---

### 2-7. CLAUDE.md 파일 배치

| 파일               | 위치                         | 내용                                                              |
| ------------------ | ---------------------------- | ----------------------------------------------------------------- |
| 루트 CLAUDE.md     | `/CLAUDE.md`                 | 프로젝트 전체 개요, 모노레포 구조, 개발 순서, 보안 규칙, Git 규칙 |
| 웹앱 CLAUDE.md     | `/apps/web/CLAUDE.md`        | 폴더 구조, 레이어 규칙, 코드 컨벤션, Tailwind, 반응형, 임시 처리  |
| 공유 CLAUDE.md     | `/packages/shared/CLAUDE.md` | 서비스/유틸/타입 규칙, TDD, API 함수 목록                         |
| Supabase CLAUDE.md | `/supabase/CLAUDE.md`        | DB 스키마, RLS, RPC, Edge Function, Storage 규칙                  |
| Docs CLAUDE.md     | `/docs/CLAUDE.md`            | 기획 문서 목차, SDD 스펙 안내                                     |

> 내용은 이미 프로젝트 파일에 작성되어 있으므로 그대로 배치한다.

---

### 2-8. docs/ 기획 문서 배치

기존 기획 문서 3개를 `docs/`에 배치:

- `docs/이사일정관리_기획정리.md`
- `docs/설계_결정사항_통합_v2.md`
- `docs/마스터_체크리스트_데이터.md`

v1 문서(`설계_결정사항_통합.md`)는 `docs/archive/`에 보관 (참고용).

---

## 3. 설치 명령어 순서

```bash
# 1. 프로젝트 루트 생성
mkdir isakok && cd isakok

# 2. pnpm 초기화 + 워크스페이스
pnpm init
# → package.json 수동 편집 (위 스펙대로)

# 3. Turborepo
pnpm add -D turbo -w

# 4. Prettier
pnpm add -D prettier -w

# 5. apps/web — Vite로 React 프로젝트 생성
pnpm create vite apps/web --template react-ts
# → 생성 후 package.json을 위 스펙대로 수정

# 6. apps/web 의존성
cd apps/web
pnpm add react react-dom
pnpm add -D @vitejs/plugin-react typescript vite
pnpm add -D tailwindcss @tailwindcss/vite
pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals

# 7. packages/shared 생성
mkdir -p packages/shared/src
cd packages/shared
pnpm init
# → package.json 수동 편집

# 8. packages/shared 의존성
pnpm add -D typescript vitest

# 9. 루트에서 전체 설치
cd ../..  # 루트로
pnpm install

# 10. 동작 확인
pnpm dev
# → http://localhost:5173 에서 "이사 매니저" + 컬러 토큰 4개 확인
```

---

## 7. 하네스 파일 상세 스펙 (v2 추가)

> **하네스란?** AI 코딩 에이전트(Claude Code)가 실수를 줄이고 일관된 품질을 유지하도록 돕는 "운영 체계".
> 3가지 역할: ① 단계 완료 후 검증(verify) ② 세션 간 상태 인수인계(handoff) ③ 스펙 기반 코드 리뷰(spec-reviewer)

### 7-1. .claude/commands/verify.md — 단계 완료 후 검증

```markdown
---
description: 개발 단계 완료 후 스펙 대비 구현을 검증합니다
---

현재 단계의 스펙 파일을 찾아서 검증을 수행해줘.

## 검증 순서

1. docs/STATUS.md에서 현재 단계 번호를 확인
2. docs/specs/{현재단계 스펙}.md의 "완료 확인 기준" 체크리스트를 하나씩 실제로 확인
   - 빌드 확인: pnpm build 실행
   - 린트 확인: pnpm lint 실행
   - 테스트 확인: pnpm test 실행
   - 나머지 항목은 파일 존재 여부, import 동작 등 직접 확인
3. 스펙에 있는데 구현 안 된 것 → "누락" 목록
4. 구현했는데 스펙에 없는 것 → "스코프 크립" 목록
5. 코드 컨벤션 위반 (CLAUDE.md 규칙 대비) → "컨벤션 위반" 목록

## 출력

검증 결과를 아래 형식으로 docs/specs/{현재단계}-verify.md에 저장해줘:

### 완료 확인 기준 결과

- [x] 또는 [ ] 각 항목별 통과/실패

### 누락 (스펙에 있는데 구현 안 됨)

- 항목 나열 (없으면 "없음")

### 스코프 크립 (구현했는데 스펙에 없음)

- 항목 나열 (없으면 "없음")

### 컨벤션 위반

- 항목 나열 (없으면 "없음")

### 종합 판정

- ✅ 통과 / ❌ 수정 필요 (수정 필요 시 우선순위순 정리)
```

> **왜 별도 세션에서 실행하나?** 코드를 짠 세션은 자기가 만든 결과에 관대해진다.
> 새 세션에서 `/verify`를 실행하면, 코드를 처음 보는 관점에서 검증하게 된다.
> Claude Code에서: `/clear` 후 `/verify` 또는 새 터미널 탭에서 `claude` 실행 후 `/verify`

### 7-2. .claude/commands/handoff.md — 세션 종료 시 상태 저장

````markdown
---
description: 현재 작업 상태를 STATUS.md에 저장합니다. 세션 종료 전 또는 컨텍스트가 60% 이상 찼을 때 실행하세요.
---

현재 작업 상태를 docs/STATUS.md에 업데이트해줘.

## 기록할 내용

1. **현재 단계**: 몇 단계 작업 중인지
2. **상태**: 진행중 / 구현완료-검증대기 / 검증완료 / 다음단계대기
3. **완료된 것**: 이번 세션에서 만든/수정한 파일 목록
4. **진행 중인 것**: 아직 끝나지 않은 작업 (있으면)
5. **다음 할 것**: 구체적인 다음 액션 1~3개
6. **알려진 문제**: 발견했지만 아직 안 고친 것 (있으면)
7. **실패한 접근**: 시도했다가 안 된 것 (있으면 — 다음 세션에서 같은 실수 반복 방지)

## 형식

docs/STATUS.md를 아래 형식으로 덮어써줘:

```md
# 프로젝트 상태

> 마지막 업데이트: {오늘 날짜}

## 현재 단계

{N}단계: {단계명} — {상태}

## 완료된 것

- {파일 경로}: {한 줄 설명}

## 진행 중인 것

- {내용} (없으면 "없음")

## 다음 할 것

1. {가장 먼저 할 것}
2. {그 다음}

## 알려진 문제

- {내용} (없으면 "없음")

## 실패한 접근 (반복 금지)

- {내용} (없으면 "없음")
```
````

````

> **언제 실행하나?**
> - 작업 세션을 끝낼 때
> - `/context`로 확인했을 때 컨텍스트 사용량이 60% 이상일 때
> - 복잡한 작업 중간에 `/clear`하기 전

### 7-3. .claude/agents/spec-reviewer.md — 스펙 vs 구현 비교 서브에이전트

```markdown
---
name: spec-reviewer
description: 스펙 문서와 실제 구현을 비교하여 차이점을 찾습니다. 단계 완료 후 자동 또는 수동으로 호출됩니다.
tools: Read, Grep, Glob, Bash
---

너는 QA 엔지니어야. 스펙 문서와 실제 코드를 비교해서 차이점을 찾는 게 임무야.

## 검토 기준

1. **스펙 준수**: 스펙에 명시된 파일, 함수, 타입이 실제로 존재하는가?
2. **타입 안전성**: TypeScript strict 모드에서 에러가 없는가?
3. **컨벤션 준수**: 해당 폴더의 CLAUDE.md 규칙을 따르는가?
   - apps/web → 레이어 규칙, 네이밍, import 순서
   - packages/shared → 순수 함수, JSDoc, 에러 처리 패턴
   - supabase → RLS, RPC 규칙
4. **누락된 엣지케이스**: 스펙의 "엣지케이스" 섹션에 있는 항목이 처리되었는가?

## 출력 형식

심각도순으로 정리:
- 🔴 필수 수정: {내용}
- 🟡 권장 수정: {내용}
- 🟢 양호: {내용}
````

> **서브에이전트란?** Claude Code 안에서 별도의 깨끗한 컨텍스트로 실행되는 미니 AI.
> 메인 세션의 컨텍스트를 오염시키지 않고, 독립적인 관점에서 코드를 봐준다.
> 호출 방법: Claude Code에서 "spec-reviewer 에이전트로 현재 단계를 리뷰해줘" 라고 말하면 됨.

### 7-4. docs/STATUS.md — 초기 상태

```markdown
# 프로젝트 상태

> 마지막 업데이트: 2026-03-31

## 현재 단계

0단계: 프로젝트 세팅 — 시작 전

## 완료된 것

- docs/specs/00-project-setup.md: 0단계 스펙 작성 완료

## 진행 중인 것

- 없음

## 다음 할 것

1. 0단계 스펙 기반으로 프로젝트 구조 생성
2. pnpm dev 동작 확인
3. /verify로 검증 → /handoff로 상태 저장

## 알려진 문제

- 없음

## 실패한 접근 (반복 금지)

- 없음
```

---

## 8. 완료 확인 기준 (체크리스트) — v2 업데이트

### 기존 항목

- [ ] `pnpm dev` → 브라우저에서 "이사 매니저" 텍스트 + 4색 토큰 표시
- [ ] `pnpm build` → 에러 없이 빌드 완료 (apps/web/dist/ 생성)
- [ ] `pnpm lint` → ESLint 에러 0개
- [ ] `pnpm format:check` → Prettier 에러 0개
- [ ] `pnpm test` → Vitest 실행 (테스트 0개이지만 에러 없이 종료)
- [ ] `@shared/` import 동작: App.tsx에서 `import { COLORS } from '@shared/constants/colors'` → 에러 없음
- [ ] `@/` import 동작: `import { App } from '@/App'` → 에러 없음
- [ ] Tailwind 커스텀 색상 동작: `bg-primary`, `text-secondary` 등이 올바른 색상으로 렌더링
- [ ] TypeScript strict 모드: `any` 타입 사용 시 ESLint 에러
- [ ] Git 초기화: `.gitignore`에 node_modules, dist, .env, .turbo 포함
- [ ] 폴더 구조: features/ 6개 폴더 존재 (빈 폴더 + .gitkeep)
- [ ] CLAUDE.md: 루트 + apps/web + packages/shared + supabase + docs 총 5개 존재

### v2 추가 항목

- [ ] `.claude/commands/verify.md` 존재
- [ ] `.claude/commands/handoff.md` 존재
- [ ] `.claude/agents/spec-reviewer.md` 존재
- [ ] `docs/STATUS.md` 존재 + 초기 상태 기록됨

---

## 9. 엣지케이스 / 주의사항

### pnpm 워크스페이스 의존성

- `@moving/shared`를 `@moving/web`에서 쓰려면 apps/web/package.json에 `"@moving/shared": "workspace:*"` 필수
- `pnpm install` 후 심볼릭 링크가 걸려야 경로 별칭이 동작

### Tailwind v4 주의

- v4는 `tailwind.config.ts`를 **사용하지 않는다** (v3과 다름)
- 대신 `index.css`의 `@theme` 블록에서 토큰 정의
- `@tailwindcss/vite` 플러그인이 PostCSS 역할을 대신함
- 기존 v3 문서/블로그 보고 따라하면 안 됨

### ESLint flat config

- ESLint v9부터 `eslint.config.js` (flat config)가 기본
- `.eslintrc.*` 형식은 deprecated — 사용하지 않음
- `eslint-plugin-import`는 flat config 호환이 불안정할 수 있음 → 0단계에서는 빼고, 필요 시 추가

### TypeScript 경로 별칭 이중 설정

- `tsconfig.app.json`의 `paths`와 `vite.config.ts`의 `resolve.alias` **둘 다** 설정해야 함
- tsconfig paths → TypeScript 컴파일러 + IDE 자동완성
- vite alias → 런타임 번들링
- 하나만 하면 IDE에서는 되는데 빌드가 안 되거나, 반대 상황 발생

### .gitkeep

- Git은 빈 폴더를 추적하지 않음
- 폴더 구조를 유지하려면 빈 `.gitkeep` 파일을 넣어야 함
- 2단계에서 실제 파일이 들어가면 `.gitkeep` 삭제

---

## 10. 이 단계에서 설치하지 않는 패키지 (시점 정리)

| 패키지                | 설치 시점 | 이유                      |
| --------------------- | --------- | ------------------------- |
| @supabase/supabase-js | 1단계     | Supabase 프로젝트 생성 후 |
| @tanstack/react-query | 2단계     | 서버 상태가 생기는 시점   |
| zustand               | 3단계     | UI 상태가 필요한 시점     |
| react-router-dom      | 2단계     | 페이지 라우팅 시작 시     |
| expo, react-native    | 9단계     | 네이티브 셸 구현 시       |

> 원칙: 사용 시점에 설치. 미리 설치하면 package.json이 지저분해지고, 버전 충돌 가능성 증가.

---

## 11. 다음 단계 연결

0단계 완료 후 → **1단계: Supabase 세팅 + 시드 데이터** (`docs/specs/01-supabase-setup.md`)

- Supabase 프로젝트 생성
- DB 테이블 6개 생성 (마이그레이션 파일)
- RLS 정책 (8단계에서 켜기 — 이 시점에서는 정의만)
- RPC 함수 (createMoveWithChecklist, updateMoveWithReschedule)
- 마스터 체크리스트 시드 데이터 46개
- Storage 버킷 (property_photos)
- .env.example + lib/supabase.ts 클라이언트 초기화

---

## 12. 전체 진행 가이드 — "이 스펙을 받은 후 어떻게 하면 되나요?"

> 이 섹션은 프로젝트 전체에 적용되는 **작업 루틴**입니다.
> 0단계뿐 아니라 모든 단계에서 동일한 패턴으로 진행합니다.

### 한 단계의 전체 흐름 (5 Step)

```
① 스펙 작성 → ② 구현 → ③ 검증 → ④ 수정 → ⑤ 인수인계
```

### Step ①: 스펙 작성 (여기서 = claude.ai 대화)

이미 했습니다 — 이 파일(`00-project-setup.md`)이 0단계의 스펙입니다.

- **누가?** 당신 + Claude (claude.ai에서 대화)
- **결과물:** `docs/specs/{N단계}-{이름}.md`
- **핵심:** "완료 확인 기준" 체크리스트가 반드시 있어야 함 (나중에 검증에 씀)

다음 단계(1단계)도 마찬가지로 "1단계 스펙 작성해줘"로 시작합니다.

### Step ②: 구현 (Claude Code에서)

스펙을 Claude Code에게 넘겨서 실제 코드를 만듭니다.

```bash
# 터미널에서 Claude Code 실행
cd isakok
claude

# Claude Code에게 지시
> docs/specs/00-project-setup.md 보고 구현해줘
```

- **누가?** Claude Code (당신은 중간중간 확인만)
- **결과물:** 실제 파일들 (코드, 설정, 폴더 구조)
- **핵심:** 스펙 파일을 `@docs/specs/00-project-setup.md` 처럼 참조시키면
  Claude Code가 스펙을 읽고 그대로 구현합니다.
- **중간에 컨텍스트가 찰 것 같으면:** `/handoff` 실행 → STATUS.md 업데이트 → 새 세션에서 이어서

### Step ③: 검증 (새 Claude Code 세션에서)

구현한 세션과 **다른 세션**에서 검증합니다.

```bash
# 방법 1: 같은 터미널에서 컨텍스트 클리어
> /clear
> /verify

# 방법 2: 새 터미널 탭에서
cd isakok
claude
> /verify
```

- **누가?** Claude Code (새 세션) — 코드를 처음 보는 관점
- **결과물:** `docs/specs/00-project-setup-verify.md` (검증 결과)
- **핵심:** "완료 확인 기준" 체크리스트를 하나씩 실제로 테스트

### Step ④: 수정 (필요한 경우만)

검증에서 문제가 나왔으면 고칩니다.

```bash
# 검증 결과를 보고 수정 지시
> docs/specs/00-project-setup-verify.md 에서 ❌ 나온 항목들 수정해줘
```

- 수정 후 다시 `/verify` → 전부 ✅ 될 때까지 반복
- 보통 1~2회면 끝남

### Step ⑤: 인수인계

```bash
> /handoff
```

- STATUS.md가 업데이트됨 → 다음 세션에서 "어디까지 했는지" 바로 파악 가능
- Git 커밋도 이 시점에서:

```bash
> 변경사항 커밋해줘
# Claude Code가 알아서 conventional commit 메시지 작성
```

### 실제 예시: 0단계를 처음부터 끝까지

```
[claude.ai에서]
나: "0단계 스펙 작성해줘"
Claude: 00-project-setup.md 생성 ← 이미 완료!

[터미널에서 — 세션 A]
$ cd ~/projects && mkdir isakok && cd isakok
$ claude
> @docs/specs/00-project-setup.md 보고 구현해줘
(Claude Code가 파일들을 만듦)
> /handoff
> exit

[터미널에서 — 세션 B (검증)]
$ claude
> /verify
(검증 결과: ✅ 12/16, ❌ 4개 누락)
> 누락된 4개 수정해줘
(수정 완료)
> /verify
(검증 결과: ✅ 16/16)
> /handoff
> 변경사항 커밋해줘
(feat: 0단계 프로젝트 세팅 완료)
> exit

[다시 claude.ai에서]
나: "1단계 스펙 작성해줘"
→ 반복
```

### 각 단계별 예상 시간

| 단계  | 내용                       | 예상 시간 |
| ----- | -------------------------- | --------- |
| 0단계 | 프로젝트 세팅              | 1~2시간   |
| 1단계 | Supabase 세팅 + 시드       | 2~3시간   |
| 2단계 | 온보딩 → 체크리스트 생성   | 3~4시간   |
| 3단계 | 대시보드 + 타임라인 + 설정 | 4~6시간   |
| 4단계 | 항목 상세 + 체크 토글      | 2~3시간   |
| 5단계 | 스마트 재배치 (4모드)      | 3~4시간   |
| 6단계 | 집 상태 기록 + 리포트      | 4~6시간   |
| 7단계 | AI 맞춤 가이드             | 3~4시간   |
| 8단계 | 인증 + 비회원 로컬 + RLS   | 4~6시간   |
| 9단계 | Expo 셸 + 배포             | 6~8시간   |

> 시간은 Claude Code가 작업하는 시간 + 당신이 확인하는 시간 합산.
> 하루 3~4시간씩 하면 약 3~4주, 집중하면 2주 정도.

### 작업 도구 정리

| 도구                     | 용도                            | 언제                       |
| ------------------------ | ------------------------------- | -------------------------- |
| **claude.ai** (이 대화)  | 스펙 작성, 기술 상담, 설계 결정 | 각 단계 시작 전            |
| **Claude Code** (터미널) | 실제 코드 구현, 파일 생성, Git  | 스펙 작성 후               |
| `/verify`                | 구현 결과 검증                  | 구현 완료 후 (새 세션)     |
| `/handoff`               | 세션 상태 저장                  | 세션 종료 전               |
| `spec-reviewer` 에이전트 | 스펙 vs 코드 심층 비교          | 검증에서 추가 리뷰 필요 시 |
