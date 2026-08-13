import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

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
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // 관측 allowlist 우회 방지(H-4): posthog-js 직접 import는 @/observability/ 내부에서만 허용.
    // 그 밖에서는 captureEvent/identify 등 래퍼만 쓰게 강제(이벤트 속성 화이트리스트 우회 차단).
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/observability/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'posthog-js',
              message:
                'PostHog는 @/observability/events·posthog 경유로만 사용하세요 (이벤트 속성 allowlist 우회 방지).',
            },
          ],
        },
      ],
    },
  },
  {
    // 아키텍처 보호 — features/**/components는 순수 UI: supabase 클라이언트·서비스 직접 접근 금지.
    // 데이터는 hooks가 가져와 props로 내려줌 (레이어 규칙, apps/web/CLAUDE.md). 타입 import는 허용.
    files: ['src/features/**/components/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'components는 순수 UI — supabase는 services/hooks 레이어에서만.',
            },
            {
              name: '@/lib/supabase',
              message: 'components는 순수 UI — supabase는 services/hooks 레이어에서만.',
            },
          ],
          patterns: [
            {
              group: ['@/services/*'],
              allowTypeImports: true,
              message: 'components는 props/훅으로 데이터를 받으세요 (타입 import만 허용).',
            },
          ],
        },
      ],
    },
  },
  {
    // stores/는 UI 상태만 — 서버 데이터·서비스 접근 금지 (레이어 규칙).
    files: ['src/stores/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@supabase/supabase-js', message: 'stores/는 UI 상태만 — 서버 접근 금지.' },
            { name: '@/lib/supabase', message: 'stores/는 UI 상태만 — 서버 접근 금지.' },
          ],
          patterns: [
            { group: ['@/services/*'], message: 'stores/는 UI 상태만 — 서비스 호출 금지.' },
          ],
        },
      ],
    },
  },
  {
    // 테스트 파일은 vitest 전역(describe/it/expect/vi)을 런타임에 주입받음 — no-undef 비대상.
    files: ['**/*.test.ts'],
    rules: {
      'no-undef': 'off',
    },
  },
  {
    // E2E(Playwright)는 Node 컨텍스트(process 등) + page.evaluate 본문의 브라우저 전역이 혼재.
    // 빌드/typecheck(tsconfig include:src) 대상 밖이고, Playwright 자체 로더가 실행한다.
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-undef': 'off',
    },
  },
)
