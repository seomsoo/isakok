# 이사일정관리 하이브리드앱 — 모노레포

이사일을 입력하면 할 일이 자동으로 일정에 배치되고, 집 상태를 사진으로 기록해 보관할 수 있는 앱.

## 기술 스택

- **모노레포**: Turborepo (apps/web, apps/mobile, packages/shared)
- **웹앱**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **상태**: TanStack Query (서버) + Zustand (UI)
- **백엔드**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **테스트**: Vitest
- **배포**: Vercel (웹), EAS Build (앱)

## 모노레포 구조

```
apps/web/          ← React Vite 웹앱 (현재 개발 중)
apps/mobile/       ← Expo 앱 (9단계에서 추가)
packages/shared/   ← 타입, 상수, 유틸, 서비스 (앱 간 공유)
supabase/          ← DB 마이그레이션, 시드, Edge Functions
docs/              ← 기획 문서, 단계별 스펙 (SDD)
.claude/           ← skills, commands
```

## 현재 단계

> 3단계: 대시보드 + 타임라인 + 설정 — 구현 진행 중

## 개발 방법론

- **SDD** (Spec-Driven Development): 각 단계 시작 전 docs/specs/에 명세 작성 → 명세 기반 구현
- **TDD**: packages/shared/utils/ — 테스트 먼저 작성 → 구현
- **작업 단위**: Claude Code 작업 1개 = 파일 1~3개 = 커밋 1개

## 개발 순서 (0~9단계)

0. 프로젝트 세팅 ← 현재
1. Supabase 세팅 + 시드 데이터
2. 온보딩 → 체크리스트 생성
3. 대시보드 + 타임라인 + 설정
4. 항목 상세 + 체크 토글
5. 스마트 재배치 (5모드)
6. 집 상태 기록 + 리포트
7. AI 맞춤 가이드 (Edge Function + Claude API)
8. 인증 + 비회원 로컬 + RLS 켜기
9. Expo 셸 + 배포

## 보안 규칙 (전역 — 절대 위반 금지)

- .env 파일 커밋 금지 (.gitignore 필수)
- API 키, 시크릿 코드에 하드코딩 금지
- eval(), dangerouslySetInnerHTML 사용 금지
- 새 npm 패키지 설치 전 npm 페이지에서 존재 여부 확인
- 클라이언트에서 anon key만 사용 (service_role key는 Edge Function에서만)
- 환경변수는 VITE\_ 접두사 필수 (Vite 클라이언트 노출 규칙)

## Git

- 브랜치: main + feature branch (feat/기능명, fix/버그명)
- 커밋: Conventional Commits (영어)
  - 형식: `type(scope): subject`
  - type: feat, fix, refactor, chore, docs, test, style
  - scope: onboarding, dashboard, timeline, checklist, photos, settings, shared, supabase
  - subject: 소문자 시작, 마침표 없음, 명령형 (add/fix/remove)
  - 본문: 선택 (대부분 제목만으로 충분, 설계 판단은 PR에 작성)
  - Co-Authored-By 트레일러 금지 (커밋, PR 모두)
- PR: feature branch → main 머지 시 반드시 작성
  - 제목: 커밋과 동일 형식 (`feat(onboarding): add 4-step form`)
  - 본문: what(뭘 했는지), why(왜 이렇게 했는지), 스크린샷(UI 변경 시)
  - 머지: Squash merge (PR당 커밋 1개로 main 히스토리 깔끔하게)

### 커밋 예시

```
feat(onboarding): add housing type selection step
fix(dashboard): prevent duplicate fetch on tab switch
refactor(shared): extract date calc to pure utility
```

### PR 예시

```
## feat(onboarding): add 4-step onboarding form

### What
온보딩 폼 4단계 구현 (이사일 → 주거유형 → 계약유형 → 첫이사 여부)

### Why
- 단일 폼이 아닌 스텝 분리: 모바일에서 한 화면에 4개 질문은 이탈률 높음
- 아파트 옵션 추가: v2 설계 반영 (세입자만 커버, 신축 입주 제외)
- validation은 스텝 단위: 선택 안 하면 다음으로 못 넘어감

### Screenshot
(UI 캡처)
```

## 하위 CLAUDE.md 위치

- apps/web/CLAUDE.md — 웹앱 코드 컨벤션, UI 규칙
- packages/shared/CLAUDE.md — 서비스/유틸/타입 규칙, 테스트
- supabase/CLAUDE.md — Deno, RLS, RPC, DB 스키마
- docs/CLAUDE.md — 기획 문서 목차, SDD 스펙 안내

## 작업 워크플로우 (하네스)

### 단계별 루틴

각 개발 단계는 동일한 패턴으로 진행:

1. 스펙 구현: "docs/specs/{N단계}.md 보고 구현해줘"
2. 코드 리뷰: `/codex:review --background` → `/codex:result`
3. 스펙 검증: `/verify`
4. 상태 저장: `/handoff`
5. 커밋: conventional commits 형식

### 커스텀 커맨드

- `/verify` — 현재 단계 스펙 대비 구현 검증 (빌드, 린트, 테스트, 체크리스트)
- `/handoff` — docs/STATUS.md에 현재 작업 상태 저장 (세션 종료 전 필수)

### Codex 플러그인 (코드 리뷰용)

- `/codex:review --background` — 일상적 코드 리뷰 (매 단계 완료 시)
- `/codex:adversarial-review --background` — 보안/설계 심층 리뷰 (1, 7, 8단계)
- `/codex:rescue` — Claude 529 에러 시 Codex에게 작업 위임

### 서브에이전트

- `spec-reviewer` — 스펙 vs 구현 심층 비교 (복잡한 단계에서만 수동 호출)

### 세션 관리

- 새 세션 시작 시: "docs/STATUS.md 읽고 이어서 작업해줘"
- 컨텍스트 60% 이상: `/handoff` → `/clear` 또는 새 세션
- 검증은 구현 세션과 다른 세션에서 실행 (자기 코드에 관대해지는 것 방지)
