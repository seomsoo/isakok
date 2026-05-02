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
.Codex/           ← skills, commands
```

## 현재 단계

> 8단계

## 개발 방법론

- **SDD** (Spec-Driven Development): 각 단계 시작 전 docs/specs/에 명세 작성 → 명세 기반 구현
- **TDD**: packages/shared/utils/ — 테스트 먼저 작성 → 구현
- **작업 단위**: Codex 작업 1개 = 파일 1~3개 = 커밋 1개

## 개발 순서 (0~10단계)

0. 프로젝트 세팅 ← 현재
1. Supabase 세팅 + 시드 데이터
2. 온보딩 → 체크리스트 생성
3. 대시보드 + 타임라인 + 설정
4. 항목 상세 + 체크 토글
5. 스마트 재배치 (5모드)
6. 집 상태 기록 + 리포트
7. AI 맞춤 가이드 (Edge Function + Codex API)
8. 하네스 고도화 (CI + 교정 루프 + 워커 격리)
9. 인증 + 비회원 로컬 + RLS 켜기
10. Expo 셸 + 배포

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
  - 본문 섹션 고정 순서: **Spec** → **What** → **Why** → **Verify** → **DB/Migration**(해당 시) → **Follow-ups** → **Screenshot**(UI 변경 시)
    - Spec: 이 PR이 대응하는 스펙 경로 한 줄 (`docs/specs/{단계}.md`)
    - What: 이번 PR에서 추가/변경된 것 요약
    - Why: 설계 판단 근거 (왜 이렇게 했는지, 대안 대비 트레이드오프)
    - Verify: `pnpm build` / `pnpm lint` / `pnpm test` 결과 + `/verify` 리포트 경로(`docs/specs/{단계}-verify.md`) + Codex 리뷰 결과 요약(P등급 + 수정 여부). PR마다 포맷 동일하게 유지
    - DB/Migration: supabase 마이그레이션/시드 변경 포함 시만. 적용 명령(`npx supabase db push`), 시드 재실행 필요 여부, 롤백 가능 여부 명시. 없으면 섹션 생략
    - Follow-ups: 의도적으로 다음 단계로 미룬 TODO (예: "과거 항목 표시는 5단계 스마트 재배치에서 교체"). 스코프 크립 방지용. 없으면 "없음"
    - Screenshot: UI 변경 시 첨부. 없으면 섹션 생략
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

### Spec
`docs/specs/02-onboarding.md`

### What
온보딩 폼 4단계 구현 (이사일 → 주거유형 → 계약유형 → 첫이사 여부)

### Why
- 단일 폼이 아닌 스텝 분리: 모바일에서 한 화면에 4개 질문은 이탈률 높음
- 아파트 옵션 추가: v2 설계 반영 (세입자만 커버, 신축 입주 제외)
- validation은 스텝 단위: 선택 안 하면 다음으로 못 넘어감

### Verify
- `pnpm build` / `pnpm lint` / `pnpm test` 통과
- `/verify` 리포트: `docs/specs/02-onboarding-verify.md` (누락/스코프 크립/컨벤션 위반 모두 없음)
- Codex 리뷰: P1 0건 / P2 1건 — 스텝 인덱스 off-by-one 수정 반영

### DB/Migration
- `supabase/migrations/00002_onboarding.sql` 추가
- 적용: `npx supabase db push`
- 시드 재실행 불필요, 롤백은 테이블 drop으로 가능

### Follow-ups
- 인증 도입 전까지 `user_id` 하드코딩 유지 (8단계에서 `auth.uid()`로 교체)

### Screenshot
(UI 캡처)
```

## 하위 AGENTS.md 위치

- apps/web/AGENTS.md — 웹앱 코드 컨벤션, UI 규칙
- packages/shared/AGENTS.md — 서비스/유틸/타입 규칙, 테스트
- supabase/AGENTS.md — Deno, RLS, RPC, DB 스키마
- docs/AGENTS.md — 기획 문서 목차, SDD 스펙 안내

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
- `/codex:rescue` — Codex 529 에러 시 Codex에게 작업 위임

### 서브에이전트

- `spec-reviewer` — 스펙 vs 구현 심층 비교 (복잡한 단계에서만 수동 호출)

### 세션 관리

- 새 세션 시작 시: "docs/STATUS.md 읽고 이어서 작업해줘"
- 컨텍스트 60% 이상: `/handoff` → `/clear` 또는 새 세션
- 검증은 구현 세션과 다른 세션에서 실행 (자기 코드에 관대해지는 것 방지)
