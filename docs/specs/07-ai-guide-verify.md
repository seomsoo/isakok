# 7단계 AI 맞춤 가이드 — 검증 리포트

> 검증일: 2026-04-27

## 완료 확인 기준 결과

### 빌드·린트·테스트

- [x] `pnpm build` 통과 (tsc + vite build 성공, turbo cache hit)
- [x] `pnpm lint` 통과 (eslint 에러 0)
- [x] `pnpm test` 통과 (16 tests, 3 파일)

### 파일 존재 (스펙 섹션 1 기준)

- [x] `supabase/migrations/00007_ai_guide_cache_inflight.sql` — ai_guide_cache ALTER + RPC 2개
- [x] `supabase/migrations/00008_system_config.sql` — system_config 테이블
- [x] `supabase/migrations/00009_enhance_guide_content.sql` — guide_content 보강 3건 + version bump
- [x] `supabase/migrations/00010_repair_ai_guide_content_offsets.sql` — sort_order 오프셋 보정
- [x] `supabase/migrations/00011_fix_ai_guide_claim_insert.sql` — claim RPC INSERT 후 즉시 true 반환
- [x] `supabase/functions/generate-ai-guide/index.ts` — Edge Function 본체
- [x] `supabase/functions/_shared/prompts/checklist-guide.ts` — 프롬프트 v1.0.1 + parseResponse + normalizeGuides
- [x] `supabase/functions/_shared/anthropic.ts` — Anthropic API 래퍼
- [x] `supabase/functions/_shared/cacheKey.ts` — 캐시 키 생성 (prompt_version 포함)
- [x] `supabase/functions/_shared/supabaseAdmin.ts` — service_role 클라이언트
- [x] `supabase/functions/_shared/conditionsValidator.ts` — 화이트리스트 검증 + isUuid
- [x] `supabase/functions/_shared/logger.ts` — 구조화 로그
- [x] `supabase/functions/_shared/cors.ts` — CORS 헤더 (x-debug-timing 포함)
- [x] `packages/shared/src/types/aiGuide.ts` — 요청/응답/도메인 타입
- [x] `packages/shared/src/constants/aiGuide.ts` — 화이트리스트 상수
- [x] `packages/shared/src/utils/cacheKey.ts` — 클라이언트용 캐시 키
- [x] `packages/shared/src/utils/conditionTags.ts` — 조건 태그 계산 (전체조건 제외)
- [x] `packages/shared/src/index.ts` — 신규 export 추가 확인
- [x] `apps/web/src/features/ai-guide/hooks/useGenerateAiGuide.ts`
- [x] `apps/web/src/features/ai-guide/hooks/queryKeys.ts`
- [x] `apps/web/src/features/ai-guide/services/aiGuide.ts`
- [x] `apps/web/src/features/checklist-detail/components/PersonalizedTipCard.tsx`
- [x] `apps/web/src/features/checklist-detail/components/GuideNoteSection.tsx` — 수정 완료
- [x] `apps/web/src/pages/DashboardPage.tsx` — 수정 완료 (마운트 시 트리거)
- [x] `apps/web/src/pages/ChecklistDetailPage.tsx` — 수정 완료 (GuideNoteSection props)
- [x] `apps/web/src/stores/aiGuideStore.ts`

### DB (스펙 섹션 2 기준)

- [x] `ai_guide_cache.generating_at` 컬럼 추가 (00007)
- [x] `idx_ai_guide_cache_key` 인덱스 생성 (00007)
- [x] `claim_ai_guide_generation` RPC — SECURITY DEFINER, service_role만 실행 가능
- [x] `apply_ai_guides` RPC — SECURITY DEFINER, service_role만 실행 가능
- [x] `system_config` 테이블 — key PK, value integer, updated_at trigger, RLS SELECT public
- [x] `guide_content` 보강 3건 (#11, #41/#42) + master_version bump
- [x] 오프셋 보정 마이그레이션 (00010) — sort_order 불일치 수정
- [x] claim RPC INSERT 직후 true 반환 수정 (00011)

### Edge Function (스펙 섹션 4 기준)

- [x] CORS preflight 처리 (OPTIONS)
- [x] moveId 형식 검증 (isUuid)
- [x] moves 테이블에서 조건 직접 조회 (ADR-018 — 클라이언트 조건 미수신)
- [x] isValidConditions 화이트리스트 검증
- [x] user_checklist_items + master_checklist_items JOIN 조회
- [x] system_config.master_checklist_version 조회
- [x] 캐시 키 생성 (prompt_version 포함)
- [x] 캐시 히트 분기 (master_version + generating_at + guides 검증)
- [x] claim_ai_guide_generation RPC 호출 (lock 획득)
- [x] lock 실패 시 5초 대기 → 재조회 → TIMEOUT
- [x] Claude API 호출 (callAnthropic — model env, 120s timeout)
- [x] parseResponse + normalizeGuides 검증
- [x] 캐시 저장 + lock 해제 (generating_at=null)
- [x] apply_ai_guides RPC로 user_checklist_items batch 반영
- [x] catch 블록에서 best-effort lock 해제
- [x] 에러 코드 분기 (TimeoutError/ParseError/기타)
- [x] 디버그 타이밍 (x-debug-timing / ?debug_timing=1)
- [x] 구조화 로그 (각 단계별 이벤트 + 타이밍)

### 프롬프트 (스펙 섹션 5 기준)

- [x] CHECKLIST_GUIDE_PROMPT_VERSION = '1.0.1'
- [x] 프롬프트 규칙 9개 모두 포함 (크로스오염 방지 규칙 2번 포함)
- [x] normalizeGuides 가드 6개: root 객체, guides 배열, 타입 체크, 입력 외 id 무시, 중복 무시, 길이 제한(0/1000)

### 클라이언트 (스펙 섹션 6~9 기준)

- [x] `invokeGenerateAiGuide` — supabase.functions.invoke, moveId만 전달
- [x] `useGenerateAiGuide` — useMutation, onSuccess에서 `['checklist']` invalidate
- [x] `aiGuideStore` — Zustand, triggeredByMoveId, hasTriggered/markTriggered
- [x] DashboardPage — useEffect에서 move.id 기반 1회 트리거, isPending/isSuccess 가드
- [x] GuideNoteSection — useRef snapshot (undefined 초기값, custom_guide ?? null)
- [x] PersonalizedTipCard — Sparkles 아이콘, 조건 태그 0~3개, "맞춤 팁" 라벨, role="note"
- [x] GuideStepsSection — `tip` prop 제거 (순수 단계 목록)
- [x] GuideNoteSection 항상 렌더 (guide_steps 유무 무관)
- [x] ChecklistDetailPage — userConditions/itemConditions prop 전달

### 보안 (스펙 섹션 11 기준)

- [x] ANTHROPIC_API_KEY — Edge Function 환경변수만 (클라이언트 미노출)
- [x] 클라이언트는 moveId만 전송 (conditions/items 미전달)
- [x] service_role 클라이언트 사용 (Edge Function)
- [x] isValidConditions + isUuid 입력 검증
- [x] normalizeGuides — 환각 id 차단, 중복 제거, 길이 제한
- [x] eval/dangerouslySetInnerHTML 미사용

## 누락 (스펙에 있는데 구현 안 됨)

없음

## 스코프 크립 (구현했는데 스펙에 없음)

- `packages/shared/src/constants/aiGuide.ts`에 `AI_GUIDE_TIMEOUT_MS`, `VALID_HOUSING_TYPES`, `VALID_CONTRACT_TYPES`, `VALID_MOVE_TYPES` 상수가 정의되어 있으나 `index.ts`에서 export하지 않고 어디서도 사용되지 않음 — 사실상 dead code. 삭제하거나 export 추가 권장. 위험도 낮음
- 마이그레이션 번호가 스펙(00005~00007)과 실제(00007~00011)가 다름 — 스펙 v2에서 정정 언급했지만 실제 번호는 4단계·6단계 마이그레이션이 먼저 점유해서 00007부터 시작. 기능 정합성에 영향 없음
- `callAnthropic` 반환 타입에 `stop_reason` 필드 추가 (스펙에는 없지만 디버그 타이밍에 활용)

## 컨벤션 위반

없음

## Codex 코드리뷰 결과

- **[P1] DashboardPage:48-52** — 트리거가 move.id 기준 1회성이라 Settings에서 조건 변경 후 재생성 안 됨
  - 문제: `hasTriggered(move.id)`가 세션 내 영구 true. 주거/계약/이사방법 변경 후 대시보드 재진입해도 Edge Function 재호출하지 않아, 이전 조건의 custom_guide가 유지됨
  - 수정: ✅ 수정 완료 — trigger key를 `${moveId}_${housing_type}_${contract_type}_${move_type}`로 변경. 조건 변경 시 key가 달라져 자동 재트리거. `aiGuideStore`의 `triggeredByMoveId` → `triggeredKeys`로 일반화

- **[P1] 00011_fix_ai_guide_claim_insert.sql:27-29** — master_version 조기 bump로 실패 시 stale 캐시
  - 문제: UPDATE가 기존 row의 `master_version`을 새 버전으로 bump하면서 `guides`는 이전 값 유지. Anthropic 호출 실패 시 catch에서 `generating_at`만 null로 초기화하므로, 다음 요청이 `master_version === currentVersion`으로 캐시 히트 판정해 stale guides를 영구 제공
  - 수정: ✅ 수정 완료 — Edge Function catch 블록에서 `generating_at: null`과 함께 `master_version: 0`으로 리셋. 0은 실제 version(1+)과 불일치하므로 다음 요청에서 재생성 분기 진입

- **[P2] 00011_fix_ai_guide_claim_insert.sql:31-34** — in-flight lock(30초)이 LLM timeout(120초)보다 짧음
  - 문제: Anthropic 호출이 30초 이상 걸리면 다른 요청이 lock을 재획득해 중복 LLM 호출 발생. 비용 낭비 + 캐시 race
  - 수정: ✅ 수정 완료 — `00012_extend_claim_lock_timeout.sql` 마이그레이션 추가. stale lock 판정 interval을 `30 seconds` → `150 seconds`로 변경 (LLM 120초 + 30초 버퍼)

## spec-reviewer 결과

서브에이전트 `spec-reviewer`로 스펙 vs 구현 심층 비교 수행 (29개 일치, 5개 차이, 1개 누락, 3개 스코프크립).

### 🔴 필수 수정

- ~~스펙 마이그레이션 번호(00005~00008)와 실제 파일(00007~00012) 불일치~~ → ✅ 스펙 업데이트 완료 (00005~00008 → 00007~00012, 폴더 구조·섹션 제목·SQL 주석·부록 B·부록 D 모두 정정)

### 🟡 권장 수정 (코드)

- ~~`GuideNoteSection`의 `hasSteps` prop 선언만 있고 미사용~~ → ✅ 인터페이스에서 제거 완료, ChecklistDetailPage에서도 prop 전달 제거
- `PersonalizedTipCard` 디자인 토큰(아이콘 13px, rounded-xl, py-3.5, font-bold uppercase)이 스펙(20px, rounded-2xl, py-4, font-semibold)과 다름 → 의도적 디자인 조정이므로 스펙 업데이트 필요 (코드 변경 불필요)
- `GuideNoteSection`에서 스펙의 `SectionTitle "참고하면 좋아요"` 렌더 누락 → 의도적 간소화. 스펙 반영 필요

### 🟡 권장 수정 (스펙/문서)

- `shared/utils/cacheKey.ts`에 `prompt_version` 파라미터 없음 — Edge Function 쪽과 "동일 로직" 주장 불일치. 현재 클라이언트에서 미사용이라 실질 영향 없음
- `00012_extend_claim_lock_timeout.sql` (lock 150초 확장)이 스펙에 미기재
- 에러 시 `master_version: 0` 리셋 로직이 스펙에 미기재
- CLAUDE.md의 import 별칭 `@shared/`와 실제 `@moving/shared` 불일치 (빌드에는 문제없음)

### 🟢 양호 (핵심 설계)

- 데이터 플로우 전체 시퀀스 (스펙 섹션 3) — 완전 일치
- 에러/폴백 규칙 11개 시나리오 — 모두 구현
- 보안 규칙 6개 항목 — 모두 준수
- 프롬프트 v1.0.1 + normalizeGuides 6개 가드 — 완전 일치
- 세션 내 스왑 금지 (useRef snapshot) — ADR-020 정확 반영
- aiGuideStore key 일반화 — 스펙보다 개선된 설계

## 종합 판정

✅ 통과 (Codex P1 2건 + P2 1건 수정 완료, spec-reviewer 코드 이슈 1건 추가 수정, 빌드 통과 확인. 스펙 문서 업데이트는 PR 전에 별도 처리)
