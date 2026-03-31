# supabase/ — DB, Edge Functions, 인증

## DB 스키마 (6개 테이블)

### users

id (uuid PK), email, nickname, provider, created_at, updated_at

### moves

id (uuid PK), user_id (FK→users, indexed), moving_date, housing_type (CHECK: '원룸'|'오피스텔'|'빌라'|'아파트'|'투룸+'), contract_type (CHECK: '월세'|'전세'), move_type (CHECK: '용달'|'반포장'|'포장'|'자가용'), is_first_move (boolean), status (CHECK: 'active'|'completed'|'cancelled'), from_address, to_address, created_at, updated_at, deleted_at

### master_checklist_items

id (uuid PK), title, description, guide_content, guide_url, d_day_offset (integer), housing_types (text[]), contract_types (text[]), move_types (text[]), category, sort_order, is_skippable (boolean), guide_type (CHECK: 'tip'|'warning'|'critical'), created_at, updated_at

### user_checklist_items

id (uuid PK), move_id (FK, indexed), user_id (FK, indexed), master_item_id (FK), is_completed (boolean default false), assigned_date (date), completed_at (timestamptz), memo, custom_guide, created_at, updated_at

### property_photos

id (uuid PK), move_id (FK, indexed), user_id (FK, indexed), photo_type (CHECK: 'move_in'|'move_out'), room (CHECK: 'entrance'|'room'|'bathroom'|'kitchen'|'balcony'|'other'), location_detail, group_key, image_url, image_hash, memo, taken_at, uploaded_at, created_at, updated_at, deleted_at

### ai_guide_cache

id (uuid PK), cache_key (text UNIQUE), master_version (integer), guides (jsonb), created_at, updated_at

## DB 규칙

- 모든 테이블에 updated_at trigger 자동 갱신
- FK 컬럼에 인덱스
- soft delete: deleted_at IS NULL 조건으로 조회
- user_id 비정규화: RLS에서 JOIN 없이 권한 체크용

## RLS 정책 (8단계에서 켜기)

**지금(0~7단계): RLS 끔, 서비스키로 개발**
**8단계: 아래 정책 전부 켜기 + 전수 검증**

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

### RPC 규칙

- SECURITY INVOKER 사용 (SECURITY DEFINER 아님 — RLS 적용을 위해)

## Edge Functions (Deno 런타임)

### 필수 규칙

- import: URL 또는 npm: 접두사 (`from 'npm:패키지명'` 또는 `from 'https://...'`)
- require() 사용 금지
- 환경변수: Deno.env.get('KEY') (process.env 아님)
- serve() 함수로 HTTP 핸들러
- Node.js 전용 API (fs, path 등) 사용 금지

### generate-ai-guide

- 모델: claude-sonnet-4-20250514
- 캐시 키: ${housing_type}_${contract*type}*${move_type}_${is_first_move}
- 캐시 있고 버전 일치 → 바로 반환
- 캐시 없거나 버전 불일치 → Claude API 호출 → 캐시 저장 → 반환
- 에러 시 기존 guide_content로 폴백

## Storage

- property_photos 버킷: **private** (public 아님)
- 파일 타입: 이미지만 (image/jpeg, image/png, image/webp)
- 파일 크기: 10MB 이하
- 업로드 순서: EXIF 추출 → SHA-256 해시 → 리사이징(1920px, 80%) → 업로드

## 환경변수

- VITE_SUPABASE_URL — 클라이언트용 (anon key와 함께)
- VITE_SUPABASE_ANON_KEY — 클라이언트용 (RLS 적용됨)
- SUPABASE_SERVICE_ROLE_KEY — Edge Function에서만 (클라이언트 노출 금지)
- ANTHROPIC_API_KEY — Edge Function에서만

## 시드 데이터

- 마스터 체크리스트 46개 항목 (docs/master-checklist-data.md 원본)
- 검증 결과 반영: #31 한전ON, #01 2026 시세, #41 정부24, #13 온라인 처리
- Threads 분석 반영: #46 사전 실측 추가, guide_url 15개+ 확충
