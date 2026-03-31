# 프로젝트 상태

> 마지막 업데이트: 2026-03-31

## 현재 단계

0단계: 프로젝트 세팅 — 검증완료

## 완료된 것

- docs/specs/00-project-setup.md: 0단계 스펙 작성 완료
- docs/specs/00-verify.md: 0단계 검증 결과 저장 (16개 항목 전체 통과)
- apps/web/: React 19 + Vite + TypeScript + Tailwind v4 웹앱 세팅
- packages/shared/: @shared/ 경로 별칭, constants/colors.ts 등 공유 패키지
- supabase/: 디렉토리 구조 생성
- .gitignore: node_modules, dist, .env, .turbo 포함
- .prettierrc / .prettierignore: Prettier 설정
- turbo.json: Turborepo 파이프라인 설정
- pnpm-workspace.yaml: 워크스페이스 설정
- .claude/commands/verify.md: /verify 커맨드
- .claude/commands/handoff.md: /handoff 커맨드
- .claude/agents/spec-reviewer.md: spec-reviewer 에이전트

## 진행 중인 것

- 없음

## 다음 할 것

1. `eslint-plugin-import` 설치 및 `apps/web/eslint.config.js`에 import 순서 규칙 추가 (CLAUDE.md 컨벤션 충족)
2. 1단계 스펙 작성: `docs/specs/01-supabase-setup.md`
3. 1단계 구현: Supabase 프로젝트 생성 + DB 마이그레이션 + 시드 데이터

## 알려진 문제

- `eslint-plugin-import` 미설치 — apps/web/CLAUDE.md에 import 순서 규칙이 명시되어 있으나 패키지 미설치 (1단계 시작 전 해결 권장)

## 실패한 접근 (반복 금지)

- 없음
