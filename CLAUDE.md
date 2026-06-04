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
apps/web/          ← React Vite 웹앱
apps/mobile/       ← Expo 네이티브 셸 (WebView 래핑 + 네이티브 인증)
packages/shared/   ← 타입, 상수, 유틸, 서비스 (앱 간 공유)
supabase/          ← DB 마이그레이션, 시드, Edge Functions
docs/              ← 기획 문서, 단계별 스펙 (SDD)
.claude/           ← skills, commands
```

## 현재 단계

> 10-4단계: 정식 출시 준비 (공개 전 하드닝 + 부가 기능) — 코드 머지 완료(PR #61). 배포·콘솔(마이그레이션 push, Edge Function 배포, 시크릿, Kakao 콘솔, TestFlight) 운영 단계. ADR-075로 dev=prod 단일 프로젝트 운영.

## 개발 방법론

- **SDD** (Spec-Driven Development): 각 단계 시작 전 docs/specs/에 명세 작성 → 명세 기반 구현
- **TDD**: packages/shared/utils/ — 테스트 먼저 작성 → 구현
- **작업 단위**: Claude Code 작업 1개 = 파일 1~3개 = 커밋 1개

## 개발 순서 (0~10단계)

0. ✅ 프로젝트 세팅
1. ✅ Supabase 세팅 + 시드 데이터
2. ✅ 온보딩 → 체크리스트 생성
3. ✅ 대시보드 + 타임라인 + 설정
4. ✅ 항목 상세 + 체크 토글 + 메모
5. ✅ 스마트 재배치 (5모드)
6. ✅ 집 상태 기록 + 리포트
7. ✅ AI 맞춤 가이드 (Edge Function + Claude API)
   8-1. ✅ 하네스 코어 (로컬 커밋훅 + CI + /auto-fix)
   8-2. ✅ 하네스 CI 봇 (PR 요약 + dry-run 분석 + 서브에이전트 6종)
8. ✅ Expo 셸 + WebView 래핑
   10-1. ✅ 네이티브 인증 + 세션 브릿지
   10-2. ✅ RLS 활성화 + Edge Function/Storage 보안 (PR #47 머지 완료)
   10-3. ✅ 계정 삭제 + 약관 + release-gate (PR #59 머지, Android 비공개 테스트 진행 중)
   10-4. 🔄 정식 출시 준비 (사진 게이트·네이티브 미디어·cleanup·Apple/Kakao 인증·RLS CI) — 코드 머지(PR #61), 배포·콘솔 단계

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
  - scope: onboarding, dashboard, timeline, checklist, photos, settings, auth, shared, mobile, supabase
  - subject: 소문자 시작, 마침표 없음, 명령형 (add/fix/remove)
  - 본문: 선택 (대부분 제목만으로 충분, 설계 판단은 PR에 작성)
  - Co-Authored-By 트레일러 금지 (커밋, PR 모두)
- PR: feature branch → main 머지 시 반드시 작성
  - **제1원칙 — 한눈에 이해**: 코드를 안 본 사람(비개발자·리뷰어·미래의 나)도 **제목 + 맨 위 요약만 읽고** "무엇을, 왜 바꿨는지"를 알 수 있게 쓴다. 결론부터, 일상어로, 전문용어는 한 번 풀어서, 한 줄에 한 메시지. 아래 섹션은 "채우기 양식"이 아니라 이 원칙을 돕는 틀이다.
  - 제목: 커밋과 동일 형식 (`feat(onboarding): add 4-step form`)
  - 본문 순서: **요약** → **Spec** → **What** → **Why** → **Verify** → **DB/Migration**(해당 시) → **Follow-ups** → **Screenshot**(UI 변경 시)
    - 요약: 본문 **맨 위 1~2문장** (섹션 제목 없이). "이 PR은 _무엇을_ _왜_ 바꿔서 _무엇이 좋아지는지_"를 한 문장으로. 여기만 읽어도 80%는 이해돼야 함.
    - Spec: 이 PR이 대응하는 스펙 경로 한 줄 (`docs/specs/{단계}.md`)
    - What (무엇이 달라지나): 파일 나열 ❌ → "머지하면 _무엇이_ _어떻게_ 된다"를 사용자·동작 관점 불릿으로.
    - Why (왜 이렇게): 설계 판단 근거 + 대안 대비 트레이드오프. "선택 → 이유" 한 줄씩.
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

이사 정보(이사일·주거유형·계약유형·첫이사 여부)를 **4단계로 나눠 묻는 온보딩 폼**을 추가한다.
한 화면에 다 묻지 않고 단계로 쪼개 모바일 이탈률을 낮추는 게 목적.

### Spec
`docs/specs/02-onboarding.md`

### What
- 온보딩이 4단계(이사일 → 주거유형 → 계약유형 → 첫이사 여부)로 진행된다
- 각 단계에서 선택을 안 하면 다음으로 못 넘어간다 (스텝별 validation)

### Why
- 단계 분리 → 모바일에서 한 화면에 질문 4개는 이탈률이 높아서
- 아파트 옵션 추가 → v2 설계 반영 (세입자만 커버, 신축 입주 제외)

### Verify
- `pnpm build` / `pnpm lint` / `pnpm test` 통과
- `/verify` 리포트: `docs/specs/02-onboarding-verify.md` (누락/스코프 크립/컨벤션 위반 모두 없음)
- Codex 리뷰: P1 0건 / P2 1건 — 스텝 인덱스 off-by-one 수정 반영

### DB/Migration
- `supabase/migrations/00002_onboarding.sql` 추가
- 적용: `npx supabase db push`
- 시드 재실행 불필요, 롤백은 테이블 drop으로 가능

### Follow-ups
- 인증 도입 전까지 `user_id` 하드코딩 유지 (10단계에서 `auth.uid()`로 교체)

### Screenshot
(UI 캡처)
```

## 하위 CLAUDE.md 위치

- apps/web/CLAUDE.md — 웹앱 코드 컨벤션, UI 규칙
- apps/mobile/CLAUDE.md — Expo 네이티브 셸, WebView 브릿지, 인증
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
