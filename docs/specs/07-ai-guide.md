# 7단계: AI 맞춤 가이드 스펙 (SDD) v2

> 목표: 체크리스트 항목별 가이드를 유저 조건(주거유형·계약유형·이사방법)에 맞게 AI가 재작성해, 상세페이지 Note 영역에 맞춤 팁으로 노출한다
> 이 단계가 끝나면: 대시보드 첫 마운트 직후 백그라운드에서 AI 가이드가 생성되어 `user_checklist_items.custom_guide`에 저장되고, 상세페이지에서 기존 TipCard 대신 `PersonalizedTipCard`가 조건 태그와 함께 표시되는 상태

> **v2 변경 사항 (v1 → v2):**
> - 마이그레이션 번호 정정: `00007~00010` → `00007~00012` (실제 4·6단계 마이그레이션이 00005~00006 점유)
> - `ai_guide_cache`/`custom_guide` 컬럼 마이그레이션을 ALTER로 변경 (ADR-017)
> - Edge Function 요청 페이로드에서 `conditions`, `items` 제거 (ADR-018)
> - `id` 의미 통일: 모든 매칭은 `master_item_id` 기준 (ADR-018)
> - In-flight lock을 RPC로 원자화 (ADR-019)
> - `apply_ai_guides` batch update RPC 추가
> - `useCustomGuide` → 컴포넌트 snapshot 방식으로 변경 (ADR-020)
> - PersonalizedTipCardSkeleton 제거 (ADR-020)
> - `system_config.value` 타입 `text` → `integer`
> - 모델명 환경변수화 (`ANTHROPIC_MODEL`)
> - `parseResponse` 검증 강화 (`normalizeGuides`)
> - 조건 태그 "전체" 분기 로직 명시
> - "guest_id" 표현 전부 제거 (현재는 user_id 단일 컬럼 운영)
> - CORS 지원 추가 (`_shared/cors.ts`, OPTIONS preflight)
> - 프롬프트 v1.0.1: 항목 간 크로스오염 방지 규칙 강화 (ADR-022)
> - 캐시 키에 `prompt_version` 포함 — 프롬프트 수정 시 캐시 자동 무효화
> - 마이그레이션 00010: 마스터 데이터 sort_order 오프셋 보정
> - 마이그레이션 00011: `claim_ai_guide_generation` INSERT 후 바로 true 반환하도록 수정
> - UI: `GuideNoteSection`을 guide_steps 유무와 관계없이 항상 렌더
> - `useGenerateAiGuide` onSuccess에서 체크리스트 쿼리 일괄 invalidate

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- Supabase Edge Function `generate-ai-guide` 신규 구축 (Deno 런타임, Anthropic API 호출)
- `ai_guide_cache.generating_at` 컬럼 추가 (in-flight lock용)
- `system_config` 테이블 신규: `master_checklist_version` single-row 관리 → 마스터 수정 시 캐시 자동 무효화
- RPC `claim_ai_guide_generation`: 원자적 lock 획득
- RPC `apply_ai_guides`: 생성 결과를 `user_checklist_items`에 batch 반영
- `PersonalizedTipCard` 컴포넌트: Sparkles 아이콘 + 조건 태그 + "맞춤 팁" 라벨
- `GuideNoteSection` 수정: custom_guide 있으면 PersonalizedTipCard, 없으면 기존 TipCard
- 백그라운드 생성 트리거: 대시보드 마운트 시 1회 호출
- 세션 내 스왑 금지: ChecklistDetailPage 마운트 시 useRef snapshot
- 프롬프트 v1: `supabase/functions/_shared/prompts/checklist-guide.ts` 별도 파일
- `guide_content` 보강 3건: #11, #41, #42 (보증금 보호 관련 1줄씩)
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` Edge Function secret 설정

### 안 하는 것

- 인증 (Supabase Auth) — 8단계
- IndexedDB 분기 (회원/비회원) — 8단계 (현재는 user_id 단일 컬럼으로 운영, RLS 미활성)
- IP rate limit (유저 0명, Free tier가 사실상 리밋)
- 스트리밍 텍스트 UI
- "AI 맞춤" 명시 뱃지 / 재생성 버튼 / "원본 보기" 토글
- `guide_steps`/`guide_items` 개인화 (Steps/Items는 팩트, 원본 유지 — ADR-015)
- `is_first_move` 캐시 키 포함 (1단계 컬럼은 유지하되 7단계엔 미사용 — ADR-014)
- 전세사기 예방 신규 항목 10개 (별도 단계 — ADR-016)
- PersonalizedTipCardSkeleton (ADR-020에서 제거 결정)
- 대시보드 / 타임라인 UI 변경 (AI는 상세페이지 Note만 영향)
- 네이티브 카메라 / 탭바 (9단계)

---

## 1. 폴더 구조 (이 단계에서 생성/수정하는 파일)

```
supabase/
├── migrations/
│   ├── 00007_ai_guide_cache_inflight.sql   ← 생성 (ai_guide_cache ALTER + RPC 2개)
│   ├── 00008_system_config.sql             ← 생성 (system_config 테이블 + master_version=1)
│   ├── 00009_enhance_guide_content.sql     ← 생성 (guide_content 보강 3건 + master_version=2)
│   ├── 00010_repair_ai_guide_content_offsets.sql  ← sort_order 오프셋 보정
│   ├── 00011_fix_ai_guide_claim_insert.sql        ← claim RPC INSERT 후 즉시 true 반환
│   └── 00012_extend_claim_lock_timeout.sql        ← stale lock 150초로 확장
│
└── functions/
    ├── generate-ai-guide/
    │   └── index.ts                        ← 생성 (Edge Function 본체)
    └── _shared/
        ├── prompts/
        │   └── checklist-guide.ts          ← 생성 (프롬프트 v1 + parseResponse + normalizeGuides)
        ├── anthropic.ts                    ← 생성 (Anthropic API 호출 래퍼)
        ├── cacheKey.ts                     ← 생성 (조건 → 캐시 키 생성)
        ├── supabaseAdmin.ts                ← 생성 (service_role 클라이언트)
        ├── conditionsValidator.ts          ← 생성 (입력 화이트리스트 검증)
        └── logger.ts                       ← 생성 (구조화 로그)

packages/shared/src/
├── utils/
│   ├── cacheKey.ts                         ← 생성 (클라이언트용, prompt_version 미포함 — 현재 미사용)
│   └── conditionTags.ts                    ← 생성 (유저 조건 ∩ 항목 조건 교집합, 전체조건 제외)
├── types/
│   └── aiGuide.ts                          ← 생성 (요청/응답/도메인 타입)
├── constants/
│   └── aiGuide.ts                          ← 생성 (조건 화이트리스트, 타임아웃)
└── index.ts                                ← 수정 (신규 export 추가)

apps/web/src/
├── features/
│   ├── ai-guide/
│   │   ├── hooks/
│   │   │   ├── useGenerateAiGuide.ts       ← 생성 (백그라운드 트리거 뮤테이션)
│   │   │   └── queryKeys.ts                ← 생성
│   │   └── services/
│   │       └── aiGuide.ts                  ← 생성 (Edge Function 호출, moveId만 전달)
│   │
│   └── checklist-detail/
│       └── components/
│           ├── PersonalizedTipCard.tsx     ← 생성 (Sparkles + 조건 태그)
│           └── GuideNoteSection.tsx        ← 수정 (분기 + snapshot 처리)
│
├── pages/
│   ├── ChecklistDetailPage.tsx             ← 수정 (불필요. GuideNoteSection 변경만으로 충분)
│   └── DashboardPage.tsx                   ← 수정 (마운트 시 useGenerateAiGuide 트리거 1회)
│
└── stores/
    └── aiGuideStore.ts                     ← 생성 (세션당 1회 트리거 플래그)
```

---

## 2. DB 변경사항

### 2-1. 마이그레이션 00007: `ai_guide_cache` 보강 + RPC 2개

```sql
-- supabase/migrations/00007_ai_guide_cache_inflight.sql

-- 1) 기존 ai_guide_cache 테이블에 in-flight lock 컬럼 추가
ALTER TABLE public.ai_guide_cache
ADD COLUMN IF NOT EXISTS generating_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ai_guide_cache_key
ON public.ai_guide_cache(cache_key);

-- 2) lock 획득 RPC (원자적)
CREATE OR REPLACE FUNCTION public.claim_ai_guide_generation(
  p_cache_key text,
  p_master_version integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_count integer;
BEGIN
  -- 행이 없으면 INSERT, 있으면 무시 (CONFLICT 회피)
  INSERT INTO public.ai_guide_cache (cache_key, master_version, guides, generating_at)
  VALUES (p_cache_key, p_master_version, '[]'::jsonb, now())
  ON CONFLICT (cache_key) DO NOTHING;

  -- 락이 없거나 stale(30초 초과)이거나 버전 불일치면 락 획득
  UPDATE public.ai_guide_cache
  SET generating_at = now(),
      master_version = p_master_version
  WHERE cache_key = p_cache_key
    AND (
      generating_at IS NULL
      OR generating_at < now() - interval '150 seconds'
      OR master_version <> p_master_version
    );

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ai_guide_generation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_guide_generation TO service_role;

-- 3) custom_guide batch 적용 RPC
CREATE OR REPLACE FUNCTION public.apply_ai_guides(
  p_move_id uuid,
  p_guides jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.user_checklist_items u
  SET custom_guide = g.custom_guide
  FROM jsonb_to_recordset(p_guides)
    AS g(master_item_id uuid, custom_guide text)
  WHERE u.move_id = p_move_id
    AND u.master_item_id = g.master_item_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ai_guides FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_ai_guides TO service_role;
```

**설계 판단:**
- 1단계 `ai_guide_cache` 테이블 구조(id, cache_key, master_version, guides, created_at, updated_at)는 그대로. `generating_at` 컬럼만 추가.
- `IF NOT EXISTS`로 멱등성 보장 (재실행해도 안전).
- `claim_ai_guide_generation`은 ADR-019 참고. INSERT ON CONFLICT + 조건부 UPDATE 조합으로 TOCTOU race 방지.
- `apply_ai_guides`는 jsonb 배열을 한 번에 풀어서 UPDATE. Edge Function에서 25번 round-trip → 1번으로 감소.
- 두 RPC 모두 `service_role`만 실행 가능. Edge Function이 service_role 클라이언트 사용.
- `SECURITY DEFINER` + `SET search_path = public`으로 search_path 조작 공격 차단.

### 2-2. 마이그레이션 00008: `system_config` 테이블

```sql
-- supabase/migrations/00008_system_config.sql

CREATE TABLE IF NOT EXISTS public.system_config (
  key text PRIMARY KEY,
  value integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1단계 공통 trigger 함수 재사용
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.system_config
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 초기값
INSERT INTO public.system_config (key, value) VALUES ('master_checklist_version', 1)
ON CONFLICT (key) DO NOTHING;

-- RLS: 누구나 읽기, 쓰기는 service_role만 (정책 미생성)
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_config_read_all"
ON public.system_config FOR SELECT
USING (true);
```

**설계 판단:**
- `value`를 `integer`로 결정 (v1의 `text` + semver 확장은 `parseInt`와 모순). 향후 semver 필요해지면 별도 컬럼 추가하거나 마이그레이션으로 변경.
- trigger 함수는 1단계의 `public.handle_updated_at()` 그대로 사용 (v1의 `set_updated_at()`은 존재하지 않는 함수였음).
- INSERT는 `ON CONFLICT DO NOTHING`으로 멱등성 보장.

### 2-3. 마이그레이션 00009: `guide_content` 보강 + 버전 bump

```sql
-- supabase/migrations/00009_enhance_guide_content.sql

-- #11 원상복구 범위 확인
UPDATE public.master_checklist_items
SET guide_content = guide_content || E'\n통화는 녹음 시작 안내 후 녹음하고, 집주인 답변은 카톡 스크린샷으로 저장. 나중에 "그런 말 한 적 없다"는 주장을 막을 수 있음.'
WHERE sort_order = 11;

-- #41 전입신고 + 확정일자
UPDATE public.master_checklist_items
SET guide_content = guide_content || E'\n확정일자 받은 당일 인터넷등기소(www.iros.go.kr)에서 등기부등본 재확인 필수 — 당일 근저당이 새로 설정되면 보증금 순위가 밀릴 수 있음.'
WHERE sort_order = 41;

-- #42 입주 사진
UPDATE public.master_checklist_items
SET guide_content = guide_content || E'\n도배·장판을 새로 하지 않은 집은 기존 하자를 특히 꼼꼼히 촬영. 퇴실 시 "이거 네가 낸 자국"이라는 뒤집어쓰기를 막는 유일한 증거.'
WHERE sort_order = 42;

-- 마스터 버전 bump → 기존 AI 캐시 자동 무효화
UPDATE public.system_config
SET value = 2
WHERE key = 'master_checklist_version';
```

**설계 판단:**
- `updated_at = now()`는 trigger가 자동 처리하므로 명시 안 함.
- 1줄 추가 방식 → 마이그레이션 히스토리 가독성 + 프롬프트 입력량 미미한 증가.
- 이 마이그레이션 적용 시 모든 캐시 자동 무효화. Edge Function이 다음 호출 때 재생성.

### 2-4. RLS 정리

| 테이블 | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `ai_guide_cache` (1단계) | public (1단계 정책 그대로) | service_role only |
| `system_config` (2-2 신규) | public | service_role only |
| `user_checklist_items.custom_guide` | 1단계 RLS 그대로 (8단계에서 활성화) | 1단계 RLS 그대로 |

**중요:** 7단계 시점에는 1단계에서 RLS 정책만 정의돼 있고 `ENABLE ROW LEVEL SECURITY`는 8단계에서 활성화됨. 따라서 현재는 anon key로도 모든 테이블 접근 가능하지만, **Edge Function은 service_role 클라이언트를 일관 사용** (8단계 RLS 활성화 후에도 동일하게 동작하도록).

---

## 3. 데이터 플로우

### 3-1. 전체 시퀀스

```
유저 온보딩 3스텝 완료 → createMoveWithChecklist RPC 호출
  ↓ user_checklist_items 생성 (custom_guide=NULL)
  ↓
대시보드 마운트
  ↓ aiGuideStore.hasTriggered(moveId) === false 인 경우만
  ↓
useGenerateAiGuide.mutate({ moveId })   ← 페이로드는 moveId만
  ↓
POST /functions/v1/generate-ai-guide
  ↓
Edge Function:
  1. moveId로 moves 조회 → housing_type/contract_type/move_type 획득
     (실패: 유효하지 않은 moveId → INVALID_INPUT 반환)
  2. user_checklist_items + master_checklist_items JOIN으로 항목 조회
     (조건은 v1처럼 클라이언트 전달이 아닌 서버 조회 — ADR-018)
  3. cache_key 생성 (housing_type_contract_type_move_type_prompt_version)
  4. system_config.master_checklist_version 조회 (예: 2)
  5. ai_guide_cache 조회:
     ├─ 캐시 히트 + 버전 일치 + generating_at NULL → guides 추출, 6번으로
     └─ 그 외 → 6-1번 (lock 획득 시도)
  6-1. RPC claim_ai_guide_generation(cache_key, version) 호출
       ├─ true 반환 (락 획득) → Claude API 호출 → 결과 normalize → cache 저장 → 6번
       └─ false 반환 (다른 요청이 생성 중) → 5초 대기 → ai_guide_cache 재조회
              ├─ 생성 완료 → guides 추출, 6번
              └─ 여전히 진행 중 → TIMEOUT 반환
  6. RPC apply_ai_guides(moveId, guides) 호출 → user_checklist_items.custom_guide 일괄 반영
  7. { status: 'ok', source } 반환
  ↓
aiGuideStore.markTriggered(moveId) 기록
  ↓
[유저가 상세페이지 진입]
  ↓
GuideNoteSection 마운트
  ↓ user_checklist_items의 custom_guide를 useRef로 snapshot (마운트 도중 고정)
  ↓
렌더링:
  ├─ snapshot 값 있음 → PersonalizedTipCard
  └─ snapshot 값 NULL → 기존 TipCard(guide_note 폴백)
```

### 3-2. 4가지 상태와 전환

| 상태 | 설명 | 표시 |
|---|---|---|
| **Hit** | 캐시 있음, custom_guide 저장됨 | PersonalizedTipCard |
| **Miss-in-progress** | Edge Function 호출 중, 아직 응답 없음 | TipCard(guide_note) — 다음 재진입에서 PersonalizedTipCard로 자연스럽게 전환 |
| **Fallback** | API 실패/타임아웃/파싱 실패 | TipCard(guide_note), 로그만 남김 |
| **No-note** | 해당 항목에 `guide_note`도 없음 | GuideNoteSection 미렌더 |

**Skeleton 상태 없음 (ADR-020):** v1의 PersonalizedTipCardSkeleton은 사실상 표시되지 않는 코드였음 (mutation 인스턴스 격리). 제거하고 일관된 "조용한 폴백" 사용.

### 3-3. 세션 내 스왑 금지 규칙의 범위

| 범위 | 스왑 가능 여부 |
|---|---|
| 같은 ChecklistDetailPage 인스턴스(마운트 유지) | **금지** — useRef snapshot으로 첫 값 고정 |
| 상세 → 대시보드 → 상세 재진입 | 허용 — 새 마운트, 새 ref → 최신 값 snapshot |
| 대시보드 새로고침 | 허용 |
| Edge Function 호출 완료 직후 | `onSuccess`에서 체크리스트 쿼리 일괄 invalidate — 다음 마운트에서 최신 데이터 fetch. 단, 이미 마운트된 상세페이지는 useRef snapshot으로 첫 값 고정 (ADR-020 유지) |

**근거:** ADR-020 참고. `onSuccess`에서 체크리스트 쿼리를 invalidate하여 데이터 신선도를 확보하되, 이미 마운트된 상세페이지는 useRef snapshot으로 첫 값을 고정해 읽는 중 텍스트 스왑을 방지. 두 메커니즘이 병행하여 "빠른 반영 + 스왑 방지"를 모두 충족.

---

## 4. Supabase Edge Function (`generate-ai-guide`)

### 4-1. 입출력 인터페이스 (단순화 — ADR-018)

```typescript
// packages/shared/src/types/aiGuide.ts

export type AiGuideConditions = {
  housing_type: '원룸' | '오피스텔' | '빌라' | '아파트' | '투룸+';
  contract_type: '월세' | '전세';
  move_type: '용달' | '반포장' | '포장' | '자가용';
};

// 요청: moveId만 받음
export type GenerateAiGuideRequest = {
  moveId: string;
};

// 응답
export type GenerateAiGuideResponse =
  | { status: 'ok'; source: 'cache_hit' | 'generated'; updated: number }
  | { status: 'error'; code: 'TIMEOUT' | 'PARSE_FAIL' | 'API_FAIL' | 'INVALID_INPUT' | 'NOT_FOUND' };

// 도메인 타입
export type AiGeneratedGuide = {
  master_item_id: string;
  custom_guide: string;
};
```

**v1 → v2 변경:**
- 요청에서 `conditions`, `items` 제거 → `moveId`만
- 응답 타입에 `updated` 필드 추가 (몇 개 항목이 반영됐는지, 디버깅용)
- 도메인 타입의 `id` → `master_item_id`로 명시화

### 4-2. 처리 순서 (의사코드)

```typescript
// supabase/functions/generate-ai-guide/index.ts

import { serve } from 'std/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callAnthropic } from '../_shared/anthropic.ts';
import { buildCacheKey } from '../_shared/cacheKey.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { log } from '../_shared/logger.ts';
import { isValidConditions } from '../_shared/conditionsValidator.ts';
import {
  CHECKLIST_GUIDE_PROMPT_VERSION,
  buildChecklistGuidePrompt,
  parseResponse,
  normalizeGuides,
} from '../_shared/prompts/checklist-guide.ts';

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startedAt = Date.now();
  let cacheKey: string | undefined;

  try {
    const { moveId } = await req.json();

    // 1. moveId 형식 검증
    if (!moveId || typeof moveId !== 'string' || !isUuid(moveId)) {
      return json({ status: 'error', code: 'INVALID_INPUT' }, 400);
    }

    // 2. moves 조회 → 조건 획득 (서버가 source of truth)
    const { data: move, error: moveErr } = await supabaseAdmin
      .from('moves')
      .select('housing_type, contract_type, move_type')
      .eq('id', moveId)
      .is('deleted_at', null)
      .maybeSingle();

    if (moveErr || !move) {
      return json({ status: 'error', code: 'NOT_FOUND' }, 404);
    }

    if (!isValidConditions(move)) {
      return json({ status: 'error', code: 'INVALID_INPUT' }, 400);
    }

    // 3. user_checklist_items + master JOIN
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('user_checklist_items')
      .select(`
        master_item_id,
        master_checklist_items ( title, guide_content )
      `)
      .eq('move_id', moveId);

    if (itemsErr || !items || items.length === 0) {
      return json({ status: 'error', code: 'NOT_FOUND' }, 404);
    }

    // 4. 마스터 버전 조회
    const { data: versionRow } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'master_checklist_version')
      .single();
    const currentVersion = versionRow!.value as number;

    // 5. cache_key 생성 (prompt_version 포함 — 프롬프트 수정 시 캐시 자동 무효화)
    cacheKey = buildCacheKey({
      housing_type: move.housing_type,
      contract_type: move.contract_type,
      move_type: move.move_type,
      prompt_version: CHECKLIST_GUIDE_PROMPT_VERSION,
    });

    // 6. 캐시 조회
    const { data: cached } = await supabaseAdmin
      .from('ai_guide_cache')
      .select('guides, master_version, generating_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    let guides: AiGeneratedGuide[];
    let source: 'cache_hit' | 'generated';

    if (cached
        && cached.master_version === currentVersion
        && cached.generating_at === null
        && Array.isArray(cached.guides)
        && cached.guides.length > 0) {
      // 캐시 히트
      guides = cached.guides as AiGeneratedGuide[];
      source = 'cache_hit';
    } else {
      // 7. lock 획득 시도 (RPC, 원자적)
      const { data: claimed } = await supabaseAdmin.rpc('claim_ai_guide_generation', {
        p_cache_key: cacheKey,
        p_master_version: currentVersion,
      });

      if (!claimed) {
        // 다른 요청이 생성 중 → 5초 대기 후 재조회
        await sleep(5000);
        const { data: retried } = await supabaseAdmin
          .from('ai_guide_cache')
          .select('guides, master_version, generating_at')
          .eq('cache_key', cacheKey)
          .single();

        if (retried
            && retried.master_version === currentVersion
            && retried.generating_at === null
            && Array.isArray(retried.guides)
            && retried.guides.length > 0) {
          guides = retried.guides as AiGeneratedGuide[];
          source = 'cache_hit';
        } else {
          log({ cacheKey, status: 'inflight_timeout', duration_ms: Date.now() - startedAt });
          return json({ status: 'error', code: 'TIMEOUT' }, 504);
        }
      } else {
        // 8. lock 획득 성공 → Claude API 호출
        const promptItems = items.map(i => ({
          master_item_id: i.master_item_id,
          title: i.master_checklist_items.title,
          guide_content: i.master_checklist_items.guide_content,
        }));

        const prompt = buildChecklistGuidePrompt({
          conditions: move,
          items: promptItems,
        });

        const apiResponse = await callAnthropic({
          model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 16384,
          timeoutMs: 120000,
        });

        // 9. 응답 검증/정규화
        const expectedIds = new Set(promptItems.map(i => i.master_item_id));
        const parsed = parseResponse(apiResponse.content);
        guides = normalizeGuides(parsed, expectedIds);

        // 10. 캐시 저장 + lock 해제
        await supabaseAdmin
          .from('ai_guide_cache')
          .update({
            master_version: currentVersion,
            guides,
            generating_at: null,
          })
          .eq('cache_key', cacheKey);

        source = 'generated';

        log({
          cacheKey,
          status: 'success',
          source,
          duration_ms: Date.now() - startedAt,
          tokens_used: apiResponse.usage.output_tokens,
          generated_count: guides.length,
          expected_count: expectedIds.size,
        });
      }
    }

    // 11. user_checklist_items에 batch 반영
    const { data: updated } = await supabaseAdmin.rpc('apply_ai_guides', {
      p_move_id: moveId,
      p_guides: guides,
    });

    return json({ status: 'ok', source, updated: updated ?? 0 }, 200);

  } catch (err) {
    log({ status: 'error', cacheKey, error: String(err), duration_ms: Date.now() - startedAt });

    // best effort: lock 해제 + master_version 무효화 (예외 시)
    if (cacheKey) {
      try {
        await supabaseAdmin
          .from('ai_guide_cache')
          .update({ generating_at: null, master_version: 0 })
          .eq('cache_key', cacheKey);
      } catch {}
    }

    if (err.name === 'TimeoutError') {
      return json({ status: 'error', code: 'TIMEOUT' }, 504);
    } else if (err.name === 'ParseError') {
      return json({ status: 'error', code: 'PARSE_FAIL' }, 500);
    } else {
      return json({ status: 'error', code: 'API_FAIL' }, 500);
    }
  }
});
```

### 4-3. In-flight lock 상세

ADR-019 참고. 핵심은:

1. **lock 획득은 RPC 호출 1번** — `claim_ai_guide_generation(cache_key, version)`이 boolean 반환
2. **true:** 락 획득. Claude API 호출 권한 있음
3. **false:** 다른 프로세스가 락 보유 중 또는 직전에 보유했었음. 5초 대기 후 캐시 재조회.
4. **stale lock 자동 회수:** RPC 내부에 150초 초과 lock은 자동으로 무효화하는 조건이 들어 있음 (LLM 120초 timeout + 30초 버퍼). 따라서 Edge Function 크래시 후 다음 호출이 자동 복구.
5. **lock 해제:** 정상 흐름에선 `update generating_at=null`. 예외 발생 시 catch 블록에서 best-effort로 `generating_at=null, master_version=0`으로 리셋 (version 0은 실제 version 1+와 불일치하므로 다음 요청에서 재생성 분기 진입). 만약 그것도 실패하면 150초 후 stale로 자동 처리.

### 4-4. Claude API 호출

```typescript
// supabase/functions/_shared/anthropic.ts

export async function callAnthropic({
  model,
  messages,
  max_tokens,
  timeoutMs,
}: {
  model: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  max_tokens: number;
  timeoutMs: number;
}): Promise<{ content: string; usage: { input_tokens: number; output_tokens: number } }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      content: data.content[0].text,
      usage: data.usage,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('Anthropic API timeout');
      e.name = 'TimeoutError';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

**설정값 근거:**
- `model: ANTHROPIC_MODEL env (default: claude-haiku-4-5-20251001)` — Sonnet 대비 2배 빠른 응답 (ADR-021)
- `max_tokens: 16384` — 37개 항목 × 2~4문장 × 한국어 토큰 (실측 ~6,300 output tokens)
- `timeoutMs: 120000` — Haiku 실측 ~60초, Sonnet ~120초 대응
- AbortController로 행 걸린 fetch 강제 종료

**구현 시 주의:** Anthropic 공식 모델명/버전은 구현 직전 [docs.anthropic.com](https://docs.anthropic.com)에서 최신 확인 권장.

### 4-5. master_version 체크

`system_config`에서 매 호출마다 `master_checklist_version` 조회. 캐시의 `master_version`과 비교해 불일치 시 재생성 분기 진입. lock RPC 자체가 버전 불일치도 락 획득 조건으로 처리하므로 별도 분기 불필요.

### 4-6. 로깅 포맷

```typescript
// supabase/functions/_shared/logger.ts

export function log(data: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...data }));
}
```

**기록 필드:**
- `cacheKey`: 조합 식별
- `status`: `'success' | 'error' | 'inflight_timeout'`
- `source`: `'cache_hit' | 'generated'`
- `duration_ms`: 전체 처리 시간
- `tokens_used`: 생성한 경우 output_tokens
- `generated_count` / `expected_count`: 응답 누락 모니터링
- `error`: 실패 시 메시지

### 4-6-1. 디버그 타이밍

`x-debug-timing: 1` 헤더 또는 `?debug_timing=1` 쿼리 파라미터로 요청하면 응답에 `timings` 필드가 추가된다. 기본 응답 계약(`status`, `source`, `updated`)은 변경 없음.

```json
{
  "status": "ok",
  "source": "generated",
  "updated": 37,
  "timings": {
    "db_fetch_ms": 896,
    "prompt_build_ms": 0,
    "anthropic_ms": 60123,
    "model": "claude-haiku-4-5-20251001",
    "input_tokens": 5667,
    "output_tokens": 5693,
    "stop_reason": "end_turn",
    "parse_ms": 0,
    "parsed_guide_count": 37,
    "apply_guides_ms": 201,
    "total_ms": 61500
  }
}
```

에러 응답에도 디버그 요청 시 `timings`가 포함된다: `error_stage`, `error_message`, `total_ms`, 해당 단계까지의 `_ms` 값.

### 4-7. 시크릿 관리

```bash
# 최초 설정
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
supabase secrets set ANTHROPIC_MODEL=claude-haiku-4-5-20251001

# 확인
supabase secrets list
```

**금지 사항:**
- 클라이언트 코드에 API 키 하드코딩
- `.env` 파일을 Git에 커밋
- `VITE_*` prefix로 키 노출

### 4-8. 로컬 개발

```bash
# supabase/functions/.env (Git ignore)
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-haiku-4-5-20251001

# 로컬 서빙
supabase functions serve generate-ai-guide --env-file supabase/functions/.env

# 테스트 호출
curl -X POST http://localhost:54321/functions/v1/generate-ai-guide \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"moveId":"<실제 moveId>"}'
```

**로컬 검증 시나리오:**
1. 캐시 없는 상태로 호출 → `source: 'generated'` 확인
2. 같은 moveId 재호출 → `source: 'cache_hit'` 확인
3. 다른 moveId(같은 조건) 호출 → `source: 'cache_hit'` (조합 단위 캐시 검증)
4. `system_config.value`를 수동 bump → 재호출 시 재생성
5. `ANTHROPIC_API_KEY` 빈 값 → 500 응답
6. 동시 호출 2건(다른 cache_key) → 둘 다 generated
7. 동시 호출 2건(같은 cache_key) → 하나는 generated, 다른 하나는 5초 대기 후 cache_hit

---

## 5. 프롬프트 설계

### 5-1. 프롬프트 인터페이스

**입력 구조 (Edge Function 내부에서 구성):**
```typescript
{
  conditions: {
    housing_type: '원룸',
    contract_type: '월세',
    move_type: '용달',
  },
  items: [
    {
      master_item_id: 'uuid-1',
      title: '전입신고 + 확정일자 받기',
      guide_content: '정부24 온라인 또는 주민센터 방문...',
    },
    // ... 15~25개
  ],
}
```

**출력 구조 (Claude가 반환):**
```json
{
  "guides": [
    { "master_item_id": "uuid-1", "custom_guide": "원룸 월세 구조상..." }
  ]
}
```

**출력 규칙 (프롬프트에 포함):**
1. 각 `custom_guide`는 한국어 2~4문장
2. 원본 `guide_content`의 금액·법조문·기관명·전화번호·URL을 임의로 변경 금지 (인용도 그대로)
3. 조건과 무관한 항목은 원본 요약 수준 (무리한 개인화 금지)
4. 이사 경험 없는 유저도 이해할 수 있게 전문 용어는 풀어서 설명
5. 응답은 JSON만 (마크다운, 설명 금지)
6. 입력 `items`의 모든 `master_item_id`를 응답 `guides`에 포함 (누락 금지)

### 5-2. 프롬프트 파일 관리

```typescript
// supabase/functions/_shared/prompts/checklist-guide.ts

export const CHECKLIST_GUIDE_PROMPT_VERSION = '1.0.1';

type PromptItem = {
  master_item_id: string;
  title: string;
  guide_content: string;
};

export function buildChecklistGuidePrompt({
  conditions,
  items,
}: {
  conditions: AiGuideConditions;
  items: PromptItem[];
}): string {
  return `당신은 한국 이사 도우미 앱 "이사콕"의 가이드 작성자입니다.
아래 유저 조건과 체크리스트 항목들을 바탕으로, 각 항목의 기존 가이드를 유저 상황에 맞게 재작성해주세요.

## 유저 조건
- 주거 유형: ${conditions.housing_type}
- 계약 유형: ${conditions.contract_type}
- 이사 방법: ${conditions.move_type}

## 작성 규칙
1. 각 항목 custom_guide는 한국어 2~4문장.
2. 각 항목은 반드시 해당 항목의 title과 guide만 근거로 작성. 다른 항목의 절차, 기관명, URL, 법적 주의사항을 섞지 마세요.
3. 원본 guide_content에 없는 새 절차, 새 기관명, 새 URL, 새 금액, 새 법적 조언은 추가하지 마세요.
4. 원본 guide_content에 있는 금액, 법조문, 기관명, 전화번호, URL은 절대 변경하지 말고 그대로 인용.
5. 조건(주거/계약/이사방법)과 직접 관련 있는 항목만 그 조건을 반영. 관련 없는 항목은 원본 의미를 유지하며 간결히 풀어쓰세요.
6. 이사 경험이 없는 유저도 이해할 수 있게 전문 용어는 짧게 풀어서 설명하되, 원본에 없는 전문 절차를 새로 추가하지 마세요.
7. 응답은 반드시 아래 JSON 형식만 반환. 마크다운 코드블록(\`\`\`), 설명, 주석 금지.
8. 입력 항목의 모든 master_item_id를 응답 guides 배열에 포함. 누락 금지.
9. 문장 톤: "~해요", "~하세요" 같은 간결한 존댓말.

## 항목 목록
${items.map(i => `- master_item_id: ${i.master_item_id}\n  title: ${i.title}\n  guide: ${i.guide_content}`).join('\n\n')}

## 출력 형식 (이 JSON만 반환)
{"guides": [{"master_item_id": "...", "custom_guide": "..."}]}
`;
}

// 응답 파싱
export function parseResponse(content: string): unknown {
  try {
    const cleaned = content.trim().replace(/^```json\n?|\n?```$/g, '');
    return JSON.parse(cleaned);
  } catch (err) {
    const e = new Error(`Parse failed: ${(err as Error).message}`);
    e.name = 'ParseError';
    throw e;
  }
}

// 검증 + 정규화 + 누락 보고
export function normalizeGuides(
  parsed: unknown,
  expectedIds: Set<string>
): AiGeneratedGuide[] {
  if (!parsed || typeof parsed !== 'object') {
    const e = new Error('Response root is not object');
    e.name = 'ParseError';
    throw e;
  }
  const guides = (parsed as { guides?: unknown }).guides;
  if (!Array.isArray(guides)) {
    const e = new Error('guides is not array');
    e.name = 'ParseError';
    throw e;
  }

  const result: AiGeneratedGuide[] = [];
  const seen = new Set<string>();

  for (const g of guides) {
    if (!g || typeof g !== 'object') continue;
    const id = (g as any).master_item_id;
    const text = (g as any).custom_guide;
    if (typeof id !== 'string') continue;
    if (typeof text !== 'string') continue;
    if (!expectedIds.has(id)) continue;       // 입력 외 id 무시 (오염 방지)
    if (seen.has(id)) continue;               // 중복 무시 (첫 등장만)
    if (text.length === 0 || text.length > 1000) continue;  // 비정상 길이 무시
    seen.add(id);
    result.push({ master_item_id: id, custom_guide: text });
  }

  return result;
}
```

**`normalizeGuides`의 가드:**
1. JSON root 객체 검증
2. `guides` 배열 검증
3. 각 항목의 `master_item_id`/`custom_guide` 타입 검증
4. **입력에 없는 id 무시** — Claude가 환각으로 임의 id 만들어내도 차단
5. **중복 id 무시** — 같은 id 두 번 나오면 첫 것만
6. **길이 제한** — 빈 문자열 또는 1000자 초과는 비정상으로 간주, 무시

누락된 id는 결과에서 빠지고 클라이언트의 해당 user_checklist_item은 custom_guide=NULL로 남음 → 상세페이지에서 자연스럽게 guide_note 폴백.

### 5-3. 할루시네이션 가드

| 단계 | 가드 |
|---|---|
| 1차 | 프롬프트 규칙 — 원본 금액·법조문·기관명 변경 금지 |
| 2차 | parseResponse JSON 파싱 실패 → ParseError → 폴백 |
| 3차 | normalizeGuides 검증 — 입력 외 id 차단, 중복 제거, 길이 제한 |
| 4차 | 개별 항목 누락 — 해당 항목만 폴백, 다른 항목은 정상 |
| 5차 | 전역 면책 — 앱 내 "정확한 절차는 관련 기관에 직접 확인" 상시 노출 |

**검증:** 개발 중 5개 샘플 조합으로 생성 → 금액/기관명/URL 육안 검증.

### 5-4. 튜닝 워크플로우

1. `checklist-guide.ts` 수정
2. 로컬 `supabase functions serve`로 검증
3. `supabase functions deploy generate-ai-guide`
4. 품질 변화 크면 새 마이그레이션으로 `master_checklist_version` bump → 캐시 자동 무효화

---

## 6. 클라이언트 훅/서비스

### 6-1. `services/aiGuide.ts`

```typescript
// apps/web/src/features/ai-guide/services/aiGuide.ts

import { supabase } from '@/lib/supabase';
import type { GenerateAiGuideRequest, GenerateAiGuideResponse } from '@isakok/shared';

export async function invokeGenerateAiGuide(
  payload: GenerateAiGuideRequest
): Promise<GenerateAiGuideResponse> {
  const { data, error } = await supabase.functions.invoke('generate-ai-guide', {
    body: payload,
  });

  if (error) {
    throw new Error(`Edge Function invocation failed: ${error.message}`);
  }

  return data as GenerateAiGuideResponse;
}
```

**v1 → v2:** 페이로드 타입이 `{moveId}`로 단순해짐. 서비스 함수는 그대로 invoke만.

### 6-2. `useGenerateAiGuide.ts` (백그라운드 트리거)

```typescript
// apps/web/src/features/ai-guide/hooks/useGenerateAiGuide.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeGenerateAiGuide } from '../services/aiGuide';

export function useGenerateAiGuide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: invokeGenerateAiGuide,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist'] });
    },
    onError: (err) => {
      console.error('[ai-guide] background generation failed', err);
    },
  });
}
```

### 6-3. 세션 내 snapshot 처리 (ADR-020 — useCustomGuide 훅 제거)

**v1 → v2 변경:** v1의 별도 `useCustomGuide` 훅을 두지 않고, GuideNoteSection 내부에서 useRef snapshot으로 처리.

이유: `staleTime: Infinity` + `gcTime: 10분` 조합은 "10분 내 재진입 시 이전 NULL 캐시 재사용" 버그가 있었음. ref 기반은 마운트 lifetime에 정확히 종속.

```tsx
// GuideNoteSection 내부 (자세한 코드는 8-1)
const snapshotRef = useRef<string | null | undefined>(undefined);
if (snapshotRef.current === undefined && item) {
  snapshotRef.current = item.custom_guide ?? null;
}
const customGuide = snapshotRef.current;
```

### 6-4. 기존 `useChecklistItemDetail` 확장

기존 쿼리에 `custom_guide` 필드만 포함되도록 확인.

```typescript
.select(`
  *,
  custom_guide,
  master_checklist_items (...)
`)
```

→ 그 외 상세페이지 동작 변경 없음.

---

## 7. PersonalizedTipCard 디자인 스펙

### 7-1. 시각 규칙

| 요소 | 기존 TipCard | PersonalizedTipCard |
|---|---|---|
| 배경 | `bg-tertiary/50` | **동일** |
| 좌측 bar | `primary` 4px | **동일** |
| 아이콘 | `Lightbulb` (20px, primary) | `Sparkles` (20px, primary) |
| 라벨 | "Tip" | "맞춤 팁" |
| 본문 | `text-body` (secondary) | **동일** |
| 패딩 | 16px | **동일** |
| radius | 16px | **동일** |
| **조건 태그 행** | 없음 | **본문 위에 1~3개 chip** |

### 7-2. 조건 태그 계산 로직 (전체조건 제외 분기 명시)

```typescript
// packages/shared/src/utils/conditionTags.ts

import type { AiGuideConditions } from '../types/aiGuide';

const ALL_HOUSING = ['원룸', '오피스텔', '빌라', '아파트', '투룸+'] as const;
const ALL_CONTRACT = ['월세', '전세'] as const;
const ALL_MOVE = ['용달', '반포장', '포장', '자가용'] as const;

function isAllSet(values: string[], allValues: readonly string[]): boolean {
  if (values.length < allValues.length) return false;
  const set = new Set(values);
  return allValues.every(v => set.has(v));
}

export function getConditionTags({
  userConditions,
  itemConditions,
}: {
  userConditions: AiGuideConditions;
  itemConditions: {
    housing_types: string[];
    contract_types: string[];
    move_types: string[];
  };
}): string[] {
  const tags: string[] = [];

  // 항목이 "전체 주거유형"에 해당하면 태그 미노출 (특정 강조 의미 없음)
  if (!isAllSet(itemConditions.housing_types, ALL_HOUSING) &&
      itemConditions.housing_types.includes(userConditions.housing_type)) {
    tags.push(userConditions.housing_type);
  }
  if (!isAllSet(itemConditions.contract_types, ALL_CONTRACT) &&
      itemConditions.contract_types.includes(userConditions.contract_type)) {
    tags.push(userConditions.contract_type);
  }
  if (!isAllSet(itemConditions.move_types, ALL_MOVE) &&
      itemConditions.move_types.includes(userConditions.move_type)) {
    tags.push(userConditions.move_type);
  }

  return tags;  // 0~3개
}
```

**규칙:**
- 항목 조건이 "전체"면 그 차원은 강조 가치 없으므로 태그 제외
- 결과 0개면 태그 행 자체 미렌더 (PersonalizedTipCard에서 length 체크)

### 7-3. 컴포넌트 구조

```tsx
// apps/web/src/features/checklist-detail/components/PersonalizedTipCard.tsx

import { Sparkles } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

type Props = {
  tags: string[];           // 0~3개
  text: string;
  className?: string;
};

export function PersonalizedTipCard({ tags, text, className }: Props) {
  return (
    <div
      role="note"
      className={cn(
        'relative rounded-2xl bg-tertiary/50 pl-5 pr-4 py-4',
        'before:absolute before:left-0 before:top-0 before:bottom-0',
        'before:w-1 before:bg-primary before:rounded-l-2xl',
        className
      )}
    >
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2" aria-label="맞춤 조건">
          {tags.map((tag, i) => (
            <span key={tag} className="inline-flex items-center">
              <span className="text-caption bg-neutral-100 text-secondary/70 px-2 py-0.5 rounded-full">
                {tag}
              </span>
              {i < tags.length - 1 && (
                <span className="mx-1 text-secondary/40" aria-hidden>·</span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={20} className="text-primary" aria-hidden />
        <span className="text-caption text-primary font-semibold">맞춤 팁</span>
      </div>
      <p className="text-body text-secondary whitespace-pre-line">{text}</p>
    </div>
  );
}
```

### 7-4. 레이아웃 (ASCII 와이어프레임)

```
┌────────────────────────────────────────┐
│┃ [원룸] · [월세] · [용달]                │  ← 1~3개 (0개면 행 자체 생략)
│┃                                        │
│┃ ✨ 맞춤 팁                              │
│┃                                        │
│┃ 원룸 월세 구조상 보증금 1천만 원       │
│┃ 이하면 소액임차인에 해당해서, 확정일자 │
│┃ 만 받아두면 경매 시 우선 변제권이      │
│┃ 생겨요. 전입신고 당일 동주민센터에서   │
│┃ 함께 처리하면 5분이면 끝나요.          │
└────────────────────────────────────────┘
 ↑ 좌측 4px primary bar
```

### 7-5. Skeleton 미사용 (ADR-020)

v1에서 PersonalizedTipCardSkeleton을 두려 했으나, 현실적으로 표시되지 않는 코드였음 (mutation 인스턴스 격리). 제거하고 일관된 "조용한 폴백" 채택.

캐시 미스 첫 진입 유저는 `guide_note` 표시. 다음 재진입에서 `PersonalizedTipCard`. 스왑 경험 없음.

### 7-6. 접근성

- `role="note"`: 보조 정보 역할
- 조건 태그 행에 `aria-label="맞춤 조건"`
- Sparkles 아이콘 `aria-hidden` (의미는 라벨 텍스트가 전달)
- 스크린리더 흐름: "맞춤 조건, 원룸, 월세, 용달, 맞춤 팁, [본문]"

---

## 8. ChecklistDetailPage 통합

### 8-1. GuideNoteSection 분기 + snapshot

```tsx
// apps/web/src/features/checklist-detail/components/GuideNoteSection.tsx

import { useRef } from 'react';
import { getConditionTags } from '@isakok/shared';
import { PersonalizedTipCard } from './PersonalizedTipCard';
import { TipCard } from '@/shared/components/TipCard';

type Props = {
  item: {
    custom_guide: string | null;
  };
  masterItem: {
    guide_note: string | null;
    housing_types: string[];
    contract_types: string[];
    move_types: string[];
  };
  userConditions: AiGuideConditions;
};

export function GuideNoteSection({ item, masterItem, userConditions }: Props) {
  // 마운트 시점 custom_guide 값으로 영원히 고정 (ADR-020)
  const snapshotRef = useRef<string | null | undefined>(undefined);
  if (snapshotRef.current === undefined) {
    snapshotRef.current = item.custom_guide ?? null;
  }
  const customGuide = snapshotRef.current;

  // 분기
  // 1) 마운트 시점에 custom_guide 있음 → PersonalizedTipCard
  if (customGuide) {
    const tags = getConditionTags({
      userConditions,
      itemConditions: {
        housing_types: masterItem.housing_types,
        contract_types: masterItem.contract_types,
        move_types: masterItem.move_types,
      },
    });
    return (
      <section>
        <SectionTitle>참고하면 좋아요</SectionTitle>
        <PersonalizedTipCard tags={tags} text={customGuide} />
      </section>
    );
  }

  // 2) 폴백: guide_note 있으면 기존 TipCard
  if (masterItem.guide_note) {
    return (
      <section>
        <SectionTitle>참고하면 좋아요</SectionTitle>
        <TipCard>{masterItem.guide_note}</TipCard>
      </section>
    );
  }

  // 3) 둘 다 없으면 섹션 미렌더
  return null;
}
```

**핵심:**
- `snapshotRef.current === undefined`로만 첫 할당 판별. `null`도 정상값이므로 `null` 체크하면 안 됨.
- 백그라운드에서 `item.custom_guide`가 NULL → 값으로 변해도 ref는 안 바뀜
- 컴포넌트 unmount → 다음 마운트에서 새 ref → 자동으로 최신값 snapshot

### 8-2. Steps/Items 변경

- `GuideStepsSection`: `tip` prop 제거. 단계 목록만 렌더링하는 순수 컴포넌트로 변경.
- `GuideNoteSection`은 `guide_steps` 유무와 무관하게 항상 렌더링 (이전에는 `guide_steps`가 없을 때만 렌더).
- `GuideItemsSection`은 7단계에서 수정하지 않음 (ADR-015).

### 8-3. ChecklistDetailPage 자체 변경 최소화

페이지 컴포넌트는 `item.custom_guide` 필드 포함된 데이터만 GuideNoteSection에 prop으로 전달. 그 외 변경 없음.

---

## 9. 백그라운드 생성 트리거

### 9-1. 트리거 위치

DashboardPage 마운트 시점.

근거:
- 온보딩 완료 후 100% 통과하는 화면
- 유저가 대시보드 둘러보는 동안(보통 5~30초) 백그라운드 생성 완료 → 첫 상세 진입 시 캐시 히트 가능
- Settings에서 이사 정보 변경 후 재생성 필요 시 대시보드 재진입으로 자연스럽게 트리거

### 9-2. 중복 트리거 방지

```typescript
// apps/web/src/stores/aiGuideStore.ts

import { create } from 'zustand';

type AiGuideState = {
  triggeredByMoveId: Record<string, boolean>;
  markTriggered: (moveId: string) => void;
  hasTriggered: (moveId: string) => boolean;
};

export const useAiGuideStore = create<AiGuideState>((set, get) => ({
  triggeredByMoveId: {},
  markTriggered: (moveId) => set((s) => ({
    triggeredByMoveId: { ...s.triggeredByMoveId, [moveId]: true },
  })),
  hasTriggered: (moveId) => !!get().triggeredByMoveId[moveId],
}));
```

```tsx
// DashboardPage.tsx 내

const { data: move } = useCurrentMove();
const generate = useGenerateAiGuide();
const { hasTriggered, markTriggered } = useAiGuideStore();

useEffect(() => {
  if (!move) return;
  if (hasTriggered(move.id)) return;
  if (generate.isPending || generate.isSuccess) return;

  markTriggered(move.id);
  generate.mutate({ moveId: move.id });   // 페이로드는 moveId만
}, [move?.id]);
```

**v1 → v2:** 클라이언트는 더 이상 `conditions`/`items`를 만들 필요 없음. moveId만 보내면 Edge Function이 DB에서 직접 조회 (ADR-018).

### 9-3. 성공 시 동작

- `onSuccess`에서 `queryClient.invalidateQueries({ queryKey: ['checklist'] })` 호출
- 모든 체크리스트 관련 쿼리(today, timeline, detail)가 한 번에 stale 처리 → 다음 마운트에서 최신 custom_guide 포함된 데이터 fetch
- 이미 마운트된 상세페이지는 useRef snapshot으로 보호 (ADR-020)

### 9-4. 실패 시 동작

- `onError` 콜백에서 조용히 로깅만
- 재시도 없음. 다음 앱 재시작(Zustand store 초기화) 시 자동 재호출
- 유저에게 에러 토스트 노출 안 함

### 9-5. 배치 호출

Edge Function 호출 1회 = Claude API 호출 1회 = 모든 항목 일괄 생성. 항목별 호출하지 않음 (시스템 프롬프트 중복 + Edge Function invocation 수 증가 회피).

---

## 10. 에러/폴백 규칙

| 시나리오 | Edge Function 응답 | 클라이언트 동작 | UI |
|---|---|---|---|
| moveId 형식 오류 | `INVALID_INPUT` 400 | mutation isError | 폴백 (다음 세션 재시도) |
| moveId 미존재 | `NOT_FOUND` 404 | 위와 동일 | 위와 동일 |
| 조건 화이트리스트 위반 | `INVALID_INPUT` 400 | 위와 동일 | 위와 동일 |
| user_checklist_items 없음 | `NOT_FOUND` 404 | 위와 동일 | 위와 동일 |
| Claude API 5xx/429 | `API_FAIL` 500 | 위와 동일 | 위와 동일 |
| Claude API 타임아웃 10초 | `TIMEOUT` 504 | 위와 동일 | 위와 동일 |
| JSON 파싱 실패 | `PARSE_FAIL` 500 | 위와 동일 | 위와 동일 |
| 응답에 특정 id 누락 | `ok` 부분 성공 | 정상 | 누락 항목만 `guide_note` 폴백 |
| 응답에 환각 id 포함 | `ok` (normalize에서 무시) | 정상 | 환각 id 무시되어 영향 없음 |
| 캐시-마스터 버전 불일치 | `ok generated` | 정상 | 새 custom_guide 적용 |
| 동시 호출 (lock 점유) | 5초 내 완료 시 `ok cache_hit` | 정상 | |
| 동시 호출 (lock 5초 초과) | `TIMEOUT` 504 | 폴백 | |
| 네트워크 오프라인 | invoke 실패 | mutation isError | 폴백 |
| `aiGuideStore.triggered=true` | 호출 안 함 | - | 기존 custom_guide 유지 |

**원칙:** 유저에게 에러 노출 금지. 모든 실패는 guide_note 폴백으로 자연스럽게 흡수.

---

## 11. 보안

### 11-1. API 키 관리

- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`은 Supabase Edge Function secret으로만 저장
- 클라이언트 번들에 키 포함 금지

### 11-2. 캐시 오염 방어 (ADR-018)

- 클라이언트는 `moveId`만 전송. `conditions`, `items`는 Edge Function이 DB에서 조회
- 외부에서 `guide_content`를 조작해 캐시를 오염시키는 시나리오 차단
- Source of truth = `master_checklist_items` (시드 데이터로 검증된 원본)

### 11-3. moveId ownership

- service_role 사용으로 RLS 우회되지만, **요청자가 다른 유저의 moveId로 호출해도 영향이 없음**
- Edge Function이 해당 moveId의 user_checklist_items만 업데이트하므로, 공격자가 자기 user_checklist_items를 변경하지 못함
- 8단계 RLS 활성화 후엔 추가로 JWT 검증을 Edge Function에 도입 검토

### 11-4. 개인정보 최소화

Claude API 요청에 포함:
- ✅ 조건 태그 (`housing_type`, `contract_type`, `move_type`)
- ✅ master_checklist_items.title, guide_content (공개 데이터)
- ✅ master_item_id (UUID, 유저 식별 불가)

요청에 미포함:
- ❌ user_id, move_id
- ❌ moving_date
- ❌ memo, from_address, to_address

### 11-5. 입력 검증 (Edge Function)

```typescript
// supabase/functions/_shared/conditionsValidator.ts

const VALID_HOUSING = ['원룸', '오피스텔', '빌라', '아파트', '투룸+'];
const VALID_CONTRACT = ['월세', '전세'];
const VALID_MOVE = ['용달', '반포장', '포장', '자가용'];

export function isValidConditions(c: any): boolean {
  return VALID_HOUSING.includes(c?.housing_type)
      && VALID_CONTRACT.includes(c?.contract_type)
      && VALID_MOVE.includes(c?.move_type);
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
```

### 11-6. RLS 정책

| 테이블 | 정책 |
|---|---|
| `ai_guide_cache` | 1단계 정의 그대로 (SELECT public, 쓰기 service_role only) |
| `system_config` | SELECT public, 쓰기 service_role only |
| `user_checklist_items.custom_guide` | 1단계 정책 그대로 (8단계에서 활성화) |

---

## 12. 비용/관측

### 12-1. 예상 비용

**조합 수:** 5(주거) × 2(계약) × 4(이사방법) = **40개**

**조합당 비용 (실측 기준):**
- 입력 토큰: 실측 ~5,700 토큰 (37개 항목 기준)
- 출력 토큰: 실측 ~6,300 토큰 (37개 항목 × 2~4문장 한국어)
- Claude Haiku 가격(2026-04 기준): $0.80/MTok 입력, $4/MTok 출력
- 조합당: (5700 × $0.80 + 6300 × $4) / 1,000,000 ≈ $0.030 ≈ **40원**
- (참고) Sonnet 가격: $3/MTok 입력, $15/MTok 출력 → 조합당 ~$0.112 ≈ 150원

**전체 캐싱 비용:** 40 × 40원 ≈ **1,600원** (1회성, Sonnet 대비 ~75% 절감)

**운영 중 재생성:** master_version bump 1회마다 1,600원. 분기당 2~3회 → 연 약 12,000원 이하.

### 12-2. Supabase Edge Function 사용량

- Free tier: 500K invocations/월
- 예상: MAU 1,000명 × 평균 2회 = 2,000회/월 → Free tier 대비 0.4%
- 캐시 히트율 80%+ 도달 시 Claude API 비용은 거의 0

### 12-3. Anthropic Console 예산 알림

1. Anthropic Console → Settings → Spend limits
2. Monthly limit $10 설정
3. 도달 시 이메일 알림 + 호출 자동 차단

근거: 정상 운영 시 월 비용 $1 미만. $10 도달은 이상 사용 시그널.

### 12-4. 로그 활용

| 지표 | 쿼리 | 용도 |
|---|---|---|
| 캐시 히트율 | `source=='cache_hit'` / 전체 | 캐시 워밍 진행 |
| 평균 응답 시간 | AVG(duration_ms) | 성능 모니터링 |
| 토큰 사용량 | SUM(tokens_used) | 비용 검증 |
| 누락률 | (expected_count - generated_count) / expected_count | 프롬프트 품질 |
| 환각 발생 | normalizeGuides에서 제거된 id 수 | (별도 로깅 필요 시 추가) |
| 에러율 | status != 'success' / 전체 | 안정성 |

---

## 13. 검증 시나리오

(상세 verify는 `07-verify.md`에서. 여기선 체크리스트.)

### 13-1. 캐시 워밍 (신규 조합)
- [ ] 새 조합으로 온보딩 → 대시보드 진입 → 10초 내 `ai_guide_cache` 신규 row 생성
- [ ] `user_checklist_items.custom_guide` 전체 항목 NULL → 값 채워짐
- [ ] 상세페이지 진입 → `PersonalizedTipCard` 렌더, 조건 태그 0~3개 적절히 표시

### 13-2. 캐시 히트
- [ ] 캐시 존재 조합으로 새 이사 생성 → Edge Function 로그 `source: 'cache_hit'`
- [ ] Claude API 호출 로그 없음 (비용 0)
- [ ] custom_guide 즉시 채워짐 (1초 이내)

### 13-3. 세션 내 스왑 금지
- [ ] 캐시 미스 상태에서 상세 진입 → `TipCard(guide_note)`
- [ ] 같은 페이지에 머무는 동안 백그라운드 생성 완료돼도 **UI 변화 없음**
- [ ] 대시보드 → 상세 재진입 → `PersonalizedTipCard`로 자연 전환

### 13-4. 폴백
- [ ] `ANTHROPIC_API_KEY` 잘못된 값 → Edge Function `API_FAIL`
- [ ] 클라이언트는 에러 토스트 없음, 모든 상세페이지 `guide_note` 정상 표시
- [ ] Edge Function 타임아웃 시뮬레이션 → 동일하게 폴백

### 13-5. 버전 bump
- [ ] `UPDATE system_config SET value=99` 실행
- [ ] 다음 호출에서 `source: 'generated'` (재생성)
- [ ] `ai_guide_cache.master_version=99` 업데이트
- [ ] 버전 복원 후 다시 호출 → 다시 재생성 (왕복 정상)

### 13-6. UI
- [ ] 조건 태그 0개 (전체조건 항목) → 태그 행 미렌더
- [ ] 조건 태그 1개 → chip 1개만
- [ ] 조건 태그 3개 → chip 3개 + · 구분자 2개
- [ ] 접근성: VoiceOver "원룸 월세 용달 맞춤 팁" 읽힘

### 13-7. In-flight lock (RPC)
- [ ] 같은 조합으로 Edge Function 동시 2회 호출 (curl 병렬)
- [ ] 하나는 `source: 'generated'`, 다른 하나는 5초 대기 후 `source: 'cache_hit'`
- [ ] Claude API 호출 1회만 발생
- [ ] stale lock 시뮬레이션: `UPDATE ai_guide_cache SET generating_at='2020-01-01'` → 다음 호출이 락 재획득

### 13-8. 캐시 오염 방어
- [ ] curl로 `{moveId, conditions:{...}, items:[조작]}` 전송 → conditions/items 무시되고 정상 처리
- [ ] 다른 유저의 moveId로 호출 → 자기 user_checklist_items는 변경 안 됨
- [ ] Claude 응답에 입력 외 master_item_id 포함 시 normalizeGuides에서 무시

### 13-9. 누락/환각 보호
- [ ] Claude 응답에 일부 항목 누락 시 → 그 항목만 NULL, 다른 항목은 정상
- [ ] Claude 응답에 중복 id 포함 시 → 첫 등장만 채택
- [ ] custom_guide 길이 1000자 초과 → 무시되어 NULL

---

## 14. 면접 대비 포인트

### Q1. "AI를 왜 넣었나요?"

> 국내외 이사 앱 중 AI 기능이 없어서 명확한 차별화입니다. 단순 정적 체크리스트와 달리, "전입신고" 같은 항목도 원룸 월세 유저와 투룸 전세 유저는 중요한 정보가 다릅니다. AI가 유저 조건에 맞게 재작성합니다.
>
> 비용은 **조건 조합 단위 캐싱**으로 통제했습니다. 조합이 40개라 전체 캐시 완성 비용이 1,500원으로 고정됩니다. 이후 유저 수가 늘어도 추가 비용이 거의 0입니다.

### Q2. "할루시네이션 리스크는 어떻게 다뤘나요?"

> 5단계 가드를 두었습니다.
>
> 1. **프롬프트 규칙**: 원본 금액·법조문·기관명 임의 변경 금지. AI는 정보 생성이 아니라 재작성 역할.
> 2. **JSON 파싱 실패 폴백**: ParseError → guide_note 폴백.
> 3. **`normalizeGuides` 검증**: 입력에 없는 id 차단(환각), 중복 제거, 길이 제한(1000자).
> 4. **개별 항목 누락 폴백**: 응답에서 빠진 항목만 NULL, 다른 항목은 정상.
> 5. **전역 면책**: "정확한 절차는 관련 기관에 직접 확인하세요" 상시 노출.
>
> AI가 틀려도 앱이 멈추지 않고 원본 가이드로 자연스럽게 떨어집니다.

### Q3. "왜 Edge Function인가요?"

> 첫 번째는 API 키 보안. 클라이언트 번들에 Anthropic 키를 넣으면 누구나 볼 수 있습니다.
>
> 두 번째는 **캐시 오염 방어**입니다. 클라이언트가 조작된 `guide_content`를 보내면 같은 조합의 모든 미래 유저가 오염된 가이드를 받습니다. 그래서 Edge Function은 클라이언트로부터 `moveId`만 받고, 조건과 체크리스트는 자체 DB 조회로 가져옵니다. Source of truth가 서버 DB라는 원칙입니다.
>
> Edge Function은 Supabase 생태계라 별도 서버 구축 없이 서버리스로 운영 가능하고, Deno 런타임이라 TypeScript 그대로 씁니다.

### Q4. "캐시 무효화 전략?"

> `system_config` 테이블에 `master_checklist_version`을 single-row로 관리합니다. 마스터 체크리스트를 수정하는 SQL 마이그레이션에서 항상 이 버전을 함께 bump합니다.
>
> Edge Function은 호출마다 현재 버전 조회해 캐시의 `master_version`과 비교합니다. 불일치하면 캐시 폐기 후 재생성. 유저가 별도로 "업데이트" 누를 필요 없이 자동입니다.
>
> **왜 `updated_at` 기반이 아닌가?** 개별 항목 오타 하나만 고쳐도 전체 캐시가 날아가서 40 조합 × 37원이 낭비됩니다. `master_version`을 명시적으로 관리하면 "이 수정은 AI 재생성 가치가 있나?"를 개발자가 통제합니다.

### Q5. "동시성 처리는 어떻게?"

> PostgreSQL RPC로 원자적 lock을 구현했습니다. `claim_ai_guide_generation`이라는 함수가 INSERT ON CONFLICT + 조건부 UPDATE 조합으로, 두 프로세스가 동시 호출해도 한쪽만 lock을 획득합니다. boolean을 반환해서 호출자가 분기할 수 있게 했습니다.
>
> 단순 SELECT-then-UPDATE는 TOCTOU race가 있습니다. 둘 다 "lock 없음" 판단 후 동시에 Claude API를 호출해 비용 낭비 + 캐시 일관성 깨짐.
>
> stale lock(30초 초과) 자동 회수 조건도 RPC 안에 넣어, Edge Function이 크래시해도 다음 호출이 자동 복구합니다.

### Q6. "세션 내 스왑 금지는 왜 필요했나요?"

> 백그라운드 생성 방식의 부작용 처리입니다. 유저가 상세페이지 보는 도중에 텍스트가 갑자기 바뀌면 "내가 뭘 놓쳤지?" 하는 이질적 경험.
>
> 처음엔 TanStack Query의 `staleTime: Infinity`로 처리하려 했는데, `gcTime` 안에 재진입하면 이전 NULL 캐시가 재사용돼서 의도가 깨졌습니다. 그래서 `useRef` 기반 컴포넌트 snapshot으로 바꿨습니다. 마운트 시점의 첫 값으로 ref를 고정하고, 컴포넌트가 unmount되면 ref도 사라져서 다음 마운트는 새 값으로 시작.
>
> 이게 2026 AI UX 트렌드인 "ambient intelligence" 원칙과 맞습니다. AI가 있음을 유저가 의식하지 않고 자연스럽게 도움을 받는 상태.

---

## 15. 다음 단계 연결

- **8단계: 인증(RLS) + 로컬 저장소**
  - Supabase Auth (Apple/카카오/Google)
  - 익명 → 회원 마이그레이션
  - IndexedDB 기반 오프라인 저장 + 동기화 큐
  - Edge Function에 JWT 검증 추가
  - `ai_guide_cache` SELECT 정책 재검토 (현재 public → service_role only로 좁힐지)

- **9단계: Expo 네이티브 셸**
  - DevTabBar → 네이티브 탭바
  - 카메라 권한 / 사진 촬영 네이티브 처리

- **10단계 (가칭): 계약 단계 + 전세사기 예방**
  - ADR-016 참고
  - 새 카테고리 + 항목 ~10개
  - master_version bump → 7단계 캐시 자동 무효화

---

## 부록 A: 프롬프트 v1 초안

`supabase/functions/_shared/prompts/checklist-guide.ts`의 실제 프롬프트.

```
당신은 한국 이사 도우미 앱 "이사콕"의 가이드 작성자입니다.
아래 유저 조건과 체크리스트 항목들을 바탕으로, 각 항목의 기존 가이드를 유저 상황에 맞게 재작성해주세요.

## 유저 조건
- 주거 유형: {housing_type}
- 계약 유형: {contract_type}
- 이사 방법: {move_type}

## 작성 규칙
1. 각 항목 custom_guide는 한국어 2~4문장.
2. 원본 guide_content에 있는 금액, 법조문, 기관명, 전화번호, URL은 절대 변경하지 말고 그대로 인용.
3. 조건(주거/계약/이사방법)과 관련 있는 항목은 그 조건에 맞는 부분을 강조. 관련 없는 항목은 원본을 간결히 요약하는 수준으로만.
4. 이사 경험이 없는 유저도 이해할 수 있게 전문 용어는 풀어서 설명. 예: "확정일자" 처음 언급 시 "집주인 바뀌어도 보증금 지키는 절차(확정일자)"처럼.
5. 응답은 반드시 아래 JSON 형식만 반환. 마크다운 코드블록(```), 설명, 주석 금지.
6. 입력 항목의 모든 master_item_id를 응답 guides 배열에 포함. 누락 금지.
7. 문장 톤: "~해요", "~하세요" 같은 간결한 존댓말.

## 항목 목록
{items_list}

## 출력 형식 (이 JSON만 반환)
{"guides": [{"master_item_id": "...", "custom_guide": "..."}]}
```

**예시 입력:**
```json
{
  "conditions": { "housing_type": "원룸", "contract_type": "월세", "move_type": "용달" },
  "items": [
    {
      "master_item_id": "abc-123",
      "title": "전입신고 + 확정일자 받기",
      "guide_content": "정부24 온라인 또는 주민센터 방문. 신분증 + 임대차계약서 원본 필요. 전입신고는 14일 이내 의무지만, 이사 당일~다음날에 해야 대항력 확보. 확정일자는 전세/월세 모두 받아두기 — 보증금 보호의 핵심. 확정일자 받은 당일 인터넷등기소에서 등기부등본 재확인 필수."
    }
  ]
}
```

**기대 출력:**
```json
{
  "guides": [
    {
      "master_item_id": "abc-123",
      "custom_guide": "원룸 월세라도 확정일자(집주인 바뀌어도 보증금 지키는 절차)는 꼭 받으세요. 정부24 온라인이나 주민센터에서 신분증과 임대차계약서 원본을 준비해 전입신고와 함께 처리하면 5분이면 끝나요. 받은 당일에는 인터넷등기소에서 등기부등본을 한 번 더 확인해, 당일 근저당이 새로 설정되지 않았는지 체크하세요."
    }
  ]
}
```

**검증:**
- 개발 중 5개 조합으로 생성 → 각 10~15개 항목 육안 검증
- 금액·기관명·URL이 원본과 일치하는지 확인
- 조건 무관 항목(예: #31 한전ON 앱)이 과도하게 개인화되지 않았는지 확인
- 전문용어 풀어쓰기 자연스러운지 확인

---

## 부록 B: guide_content 보강 대상

마이그레이션 `00009_enhance_guide_content.sql`의 3건:

### #11 원상복구 범위 확인
**추가:** "통화는 녹음 시작 안내 후 녹음하고, 집주인 답변은 카톡 스크린샷으로 저장. 나중에 '그런 말 한 적 없다'는 주장을 막을 수 있음."

**근거:** 퇴실 시 분쟁의 1번 원인이 "구두 합의의 뒤집힘". 증거 확보가 핵심.

### #41 전입신고 + 확정일자
**추가:** "확정일자 받은 당일 인터넷등기소(www.iros.go.kr)에서 등기부등본 재확인 필수 — 당일 근저당이 새로 설정되면 보증금 순위가 밀릴 수 있음."

**근거:** 악질 집주인이 확정일자 당일 근저당 설정 치는 사례 발생. 하루 시차로 보증금 우선순위가 바뀜.

### #42 새 집 사진 (입주 기록)
**추가:** "도배·장판을 새로 하지 않은 집은 기존 하자를 특히 꼼꼼히 촬영. 퇴실 시 '이거 네가 낸 자국'이라는 뒤집어쓰기를 막는 유일한 증거."

**근거:** 원상복구비 공제 분쟁 1위 원인이 "기존 하자의 세입자 책임 전가". 입주 사진이 유일한 방어 수단.

**주의:** 이 3건은 전세사기 예방 풀스코프가 아님. 별도 단계에서 본격적으로 다룰 예정 (ADR-016).

---

## 부록 C: ADR 요약

7단계 작성 과정에서 결정된 ADR은 별도 결정사항 문서(`design-decisions-v2.md` 또는 동등 파일)에 014~020으로 추가됨. 이 스펙에서는 요약만:

- **ADR-014**: `is_first_move` 캐시 키 미반영 (조합 2배 비용 > 차별화 효과)
- **ADR-015**: custom_guide는 Note만 교체 (Steps/Items 원본 유지)
- **ADR-016**: 전세사기 예방 콘텐츠 별도 단계로 분리
- **ADR-017**: `ai_guide_cache` 마이그레이션 ALTER로 (1단계 충돌 방지)
- **ADR-018**: Edge Function이 클라이언트 입력 신뢰 안 함 (캐시 오염 방어)
- **ADR-019**: In-flight lock을 RPC로 원자화
- **ADR-020**: 세션 내 스왑 금지를 컴포넌트 snapshot으로 (Skeleton 제거 결정 포함)

---

## 부록 D: v1 → v2 변경 요약

| 영역 | v1 | v2 |
|---|---|---|
| 마이그레이션 번호 | 00007~00010 | 00007~00012 (4·6단계 마이그레이션이 00005~00006 점유) |
| ai_guide_cache | CREATE TABLE | ALTER TABLE (generating_at 컬럼만 추가) |
| custom_guide 컬럼 | 7단계에서 ADD COLUMN | **삭제 — 1단계에 이미 있음** |
| trigger 함수명 | set_updated_at | public.handle_updated_at (1단계 정의) |
| Edge Function 페이로드 | {moveId, conditions, items} | {moveId} only |
| id 의미 | 혼재 | master_item_id로 통일 |
| In-flight lock | SELECT then UPDATE | RPC claim_ai_guide_generation |
| custom_guide 반영 | for-loop UPDATE | RPC apply_ai_guides batch |
| useCustomGuide 훅 | staleTime: Infinity | **삭제** — useRef snapshot으로 대체 |
| Skeleton | PersonalizedTipCardSkeleton 컴포넌트 | **삭제** — 조용한 폴백으로 통일 |
| system_config.value | text (semver 가능) | integer |
| 모델명 | 코드 하드코딩 | ANTHROPIC_MODEL 환경변수 |
| parseResponse | JSON 파싱만 | parseResponse + normalizeGuides 분리, 환각/누락/길이 검증 |
| 조건 태그 | "전체" 분기 미명시 | isAllSet 함수로 명시 |
| guest_id 표현 | "전부 guest_id 기반" | 제거 — user_id 단일 컬럼 운영 명시 |
