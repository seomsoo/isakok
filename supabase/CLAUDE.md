# supabase/ — DB, Edge Functions, 인증

## DB 스키마 (9개 테이블)

### users

id (uuid PK), email, nickname, provider, created_at, updated_at

### moves

id (uuid PK), user_id (FK→users, indexed), moving_date, housing_type (CHECK: '원룸'|'오피스텔'|'빌라'|'아파트'|'투룸+'), contract_type (CHECK: '월세'|'전세'), move_type (CHECK: '용달'|'반포장'|'포장'|'자가용'), is_first_move (boolean), status (CHECK: 'active'|'completed'|'cancelled'), from_address, to_address, created_at, updated_at, deleted_at

### master_checklist_items

id (uuid PK), title, description, guide_content, guide_url, d_day_offset (integer), housing_types (text[]), contract_types (text[]), move_types (text[]), category, sort_order, is_skippable (boolean), guide_type (CHECK: 'tip'|'warning'|'critical'), created_at, updated_at

### user_checklist_items

id (uuid PK), move_id (FK, indexed), user_id (FK, indexed), master_item_id (FK), is_completed (boolean default false), assigned_date (date), completed_at (timestamptz), memo, custom_guide, created_at, updated_at

### property_photos

id (uuid PK), move_id (FK, indexed), user_id (FK, indexed), photo_type (CHECK: 'move_in'|'move_out'), room (CHECK: 'entrance'|'room'|'bathroom'|'kitchen'|'balcony'|'other'), location_detail, group_key, storage_path, image_hash, memo, taken_at, uploaded_at, created_at, updated_at, deleted_at

### ai_guide_cache

id (uuid PK), cache_key (text UNIQUE), master_version (integer), guides (jsonb), created_at, updated_at

### auth_provider_links (10-1, 00014)

provider (text), provider_user_id (text), user_id (FK→users, ON DELETE CASCADE), apple_refresh_token (text, nullable), created_at — 소셜 provider 식별자 ↔ user 매핑 (Kakao custom mapping ADR-048). `apple_refresh_token`은 계정 삭제 시 Apple revoke 호출용 (00021, service_role only)

### rate_limit_log (10-2, 00018)

bucket_key (text), window_start (timestamptz), count (integer) — 고정 윈도우 rate limit 카운트. `increment_rate_limit` RPC로 갱신 (IP 해시 기반)

### system_config (00008)

key (text PK), value (integer), updated_at — 정수 설정값 (예: master_version)

## DB 규칙

- 모든 테이블에 updated_at trigger 자동 갱신
- FK 컬럼에 인덱스
- soft delete: deleted_at IS NULL 조건으로 조회
- user_id 비정규화: RLS에서 JOIN 없이 권한 체크용

## RLS 정책

**10-2부터 RLS 활성화 완료** (마이그레이션 00016~00020). 7개 테이블 + storage.objects 정책 적용. 클라이언트는 anon/publishable key + 본인 데이터만 접근.

> 이전 단계(0~10-1)는 RLS 끔 + 서비스키로 개발. 10-2부터 아래 정책 ON + 전수 검증(scripts/verify/rls-smoke.ts, 16/16 통과).

10-3에서 추가: `delete-account` Edge Function이 service*role로 Storage·auth.users 삭제(클라이언트는 호출만, RLS 우회 X). 옛 anon/service_role Legacy JWT는 disable되고 새 `sb_publishable*...`/`sb*secret*...` 체계 사용 (ADR-075).

```sql
-- 이름 규칙: {테이블}_{작업}_{조건}
CREATE POLICY "users_all_own" ON users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "moves_all_own" ON moves
  FOR ALL USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "master_select_public" ON master_checklist_items
  FOR SELECT USING (true);
-- master: INSERT/UPDATE/DELETE 정책 없음 = 불가

CREATE POLICY "user_checklist_all_own" ON user_checklist_items
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "photos_all_own" ON property_photos
  FOR ALL USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "ai_cache_select_public" ON ai_guide_cache
  FOR SELECT USING (true);
```

### RLS 주의사항

- 반드시 auth.uid() 사용 (current_user, session_user 아님)
- 정책 이름 필수 (이름 없으면 수정/삭제 시 찾기 어려움)
- master_checklist_items처럼 읽기만 공개인 경우 SELECT만 정책 생성

## RPC (Database Function)

트랜잭션이 필요한 작업은 반드시 RPC로:

### createMoveWithChecklist

- 이사 INSERT → 마스터 체크리스트 조건 필터링 → user_checklist_items 복사
- assigned_date = moving_date + d_day_offset
- 원자적 트랜잭션 (중간 실패 시 전부 롤백)

### updateMoveWithReschedule

- moves UPDATE → user_checklist_items.assigned_date 전체 재계산
- is_completed, memo 등은 건드리지 않음
- 원자적 트랜잭션

### 기타 RPC (7·10단계 추가)

- `claim_ai_guide_generation` / `apply_ai_guides` — AI 가이드 생성 인플라이트 잠금 + 캐시 일괄 적용 (7단계, ADR-019)
- `migrate_anonymous_to_user` — 익명→회원 전환 시 데이터 이전 (10-1, linkIdentity 폴백 경로)
- `increment_rate_limit` — 고정 윈도우 rate limit 증가/검사 (10-2)
- `get_anonymous_cleanup_candidates` — cleanup 대상 익명 사용자 조회 (10-4)
- 트리거: `handle_new_user`(auth.users→public.users), `handle_updated_at`, `handle_user_provider_update`

### RPC 규칙

- 기본 SECURITY INVOKER (RLS 적용을 위해)
- 단, 새 행을 삽입하는 RPC(create/update)는 SECURITY DEFINER + 내부 auth.uid() 검증 (RLS가 INSERT를 막을 수 있으므로)
- SECURITY DEFINER 사용 시 반드시 IS DISTINCT FROM으로 NULL-safe 권한 체크

## Edge Functions (Deno 런타임)

### 필수 규칙

- import: URL 또는 npm: 접두사 (`from 'npm:패키지명'` 또는 `from 'https://...'`)
- require() 사용 금지
- 환경변수: Deno.env.get('KEY') (process.env 아님)
- serve() 함수로 HTTP 핸들러
- Node.js 전용 API (fs, path 등) 사용 금지

### generate-ai-guide

- 모델: claude-haiku-4-5-20251001 (ADR-021: Sonnet→Haiku 전환, 응답 시간 120s→60s)
- 캐시 키: ${housing_type}_${contract*type}*${move_type}_${prompt_version}
- 캐시 있고 버전 일치 → 바로 반환
- 캐시 없거나 버전 불일치 → Claude API 호출 → 캐시 저장 → 반환
- 에러 시 기존 guide_content로 폴백

### apple-token-exchange / kakao-token-exchange (10-1)

소셜 로그인 코드 교환 — 네이티브 SDK가 받은 authorization code/token을 서버에서 Supabase 세션으로 교환. apple은 refresh_token을 `auth_provider_links`에 저장(revoke용). (verify_jwt: 켜짐)

### kakao-unlink-webhook (10-4)

카카오 "연결 끊기" 웹훅 — 사용자가 카카오에서 앱 연결 해제 시 호출되어 해당 user 삭제(`_shared/deleteUserData`). KakaoAK 헤더로 인증 (verify_jwt: 꺼짐, ADR-078)

### delete-account (10-3)

계정 삭제 — service_role로 Storage prefix·auth.users·public.\* CASCADE 삭제 + Apple revoke(best-effort, ADR-077). 클라이언트는 호출만(RLS 우회 X). (verify_jwt: 켜짐, ADR-082)

### cleanup (10-4)

익명/orphan 정리 — 30일 미활동 익명 사용자 + orphan Storage 정리. CLEANUP_TOKEN 인증·DRY_RUN 지원 (verify_jwt: 꺼짐, ADR-076)

## Storage

- property_photos 버킷: **private** (public 아님)
- 파일 타입: 이미지만 (image/jpeg, image/png, image/webp)
- 파일 크기: 10MB 이하
- 업로드 순서: EXIF 추출 → SHA-256 해시 → 리사이징(1920px, 80%) → 업로드

## 환경변수

> 키 체계: Legacy anon/service*role JWT는 disable, `sb_publishable*_`(클라이언트)·`sb*secret*_`(서버) 사용 (ADR-075).

- VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY(=publishable) — 웹 클라이언트용 (RLS 적용)
- EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — 네이티브 클라이언트용
- SUPABASE_SERVICE_ROLE_KEY(=secret) — Edge Function에서만 (클라이언트 노출 금지)
- ANTHROPIC_API_KEY — generate-ai-guide
- APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_CLIENT_ID / APPLE_PRIVATE_KEY — apple-token-exchange·delete-account(revoke)
- KAKAO_ADMIN_KEY / KAKAO_APP_ID — kakao-token-exchange·kakao-unlink-webhook
- CLEANUP_TOKEN / DRY_RUN — cleanup

## 시드 데이터

- 마스터 체크리스트 46개 항목 (docs/master-checklist-data.md 원본)
- 검증 결과 반영: #31 한전ON, #01 2026 시세, #41 정부24, #13 온라인 처리
- Threads 분석 반영: #46 사전 실측 추가, guide_url 15개+ 확충
