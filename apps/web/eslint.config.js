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
    // 테스트 파일은 vitest 전역(describe/it/expect/vi)을 런타임에 주입받음 — no-undef 비대상.
    files: ['**/*.test.ts'],
    rules: {
      'no-undef': 'off',
    },
  },
)
