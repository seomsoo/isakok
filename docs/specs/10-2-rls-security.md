# 10-2단계: RLS 활성화 + Edge Function/Storage 보안 + 충돌 처리 RPC + 데이터 wipe 스펙 (SDD)

> 목표: 10-1에서 도입한 인증(`auth.uid()`) 위에 **인가(RLS)**를 얹는다. 6개 테이블 + `auth_provider_links`에 RLS를 활성화하고, Edge Function·Storage의 보안 구멍을 막고, 폴백 경로용 충돌 처리 RPC를 안전망으로 준비하고, 테스트 데이터를 정리한 뒤 prod를 일괄 생성한다.
>
> 이 단계가 끝나면: 모든 데이터 접근이 DB 레벨에서 본인 소유로 강제된다. service 함수의 `.eq('user_id', ...)`는 1차 방어, RLS는 DB가 강제하는 2차(최종) 방어가 된다. Edge Function은 JWT·소유권·rate limit·CORS로 보호된다. Storage 사진은 본인만 발급/업로드/삭제 가능하다. dev/prod 내부 smoke test가 RLS 켠 상태에서 통과한다.

> **완료 조건 (중요)**: "RLS 켠 상태에서 dev/prod 내부 smoke test 통과". **외부 베타·공개 URL 공유·실사용자 유입은 완료 조건이 아니다.** 외부 공개는 10-3 / release-gate로 분리한다 (§11). 10-2에서 prod는 마이그레이션 적용 + 내부 smoke test까지만 한다.

> **v1 → v2 변경 사항**: GPT 리뷰 26개 항목 중 검증 후 선별 반영 (~70% 반영, ~30%는 이미 해결/불필요)
>
> - **soft delete + RLS 정책 재설계** (P0): `moves`/`property_photos`의 `FOR ALL ... AND deleted_at IS NULL`이 휴지통 복구/영구삭제를 깨뜨림. 00016을 "ENABLE만"에서 "정책 DROP + SELECT/INSERT/UPDATE/DELETE 분리 재CREATE"로 격상. `deleted_at` 필터는 RLS에서 빼고 service query로. §3 전면 개정.
> - **rate limit 원자적 increment RPC** (P0): 테이블만 두면 race condition. `ON CONFLICT DO UPDATE RETURNING` RPC 추가. §4-3.
> - **CORS 미허용 origin 실제 403 reject** (P0): v1의 `allowOrigin = includes ? origin : ALLOWED[0]`은 미허용 origin에 첫 origin을 돌려주는 무의미한 코드 → 실제 reject. §4-3.
> - **generate-ai-guide JWT 추출 구체화** (P0): anon client + `auth.getUser()` 패턴 명시. §4-1.
> - **migrate RPC 미구현 strategy 예외 처리** (P0): `keep_target` 외 전략은 `RAISE EXCEPTION`. source가 anonymous인지 검증 추가. §6-2.
> - **users 정책 INSERT/DELETE 불허 분리** (P0): 트리거가 생성하므로 클라이언트 INSERT/DELETE 불요. SELECT/UPDATE만. §3-2.
> - **Storage dev permissive policy DROP** (P0): 새 정책 추가 전 기존 allow-all 제거. §5-2.
> - **보강**: rate_limit_log RLS+verify, master SELECT anon/authenticated 명시, system_config 정책, 수동 rls-smoke 스크립트(CI 미연결), public.users wipe 처리, photoType path segment 제거, signed URL ownership 가드, IP 해시+보존기간, IP 추출 기준.
> - **이미 해결되어 미반영**: `storage_path` 컬럼명(1단계부터 확정, image_url 미사용), cache key 서버 조회(ADR-018로 이미 moveId→moves 조회), Storage UPDATE 정책(애초에 없음+upsert=false), Storage 경로 "6단계가 이미 userId였다"는 GPT 전제(실제는 moveId 기반이 의도된 설계 — 결론은 동일해 §5-1 유지).
> - **dev wipe auth.users 처리 확정**: "결정 필요" → 삭제로 확정. §7-1.

> **v2 → v3 변경 사항**: GPT 2차 리뷰(v2 추가 SQL/코드 한정) 13개 항목 중 선별 반영
>
> - **`users_update_own` 제거** (P0): RLS는 컬럼을 못 막는데 users.provider는 migrate RPC의 anonymous 판정에 쓰이는 보안성 컬럼 → UPDATE를 열면 provider 위조로 검증 우회 가능. SELECT only로 변경. §3.
> - **migrate RPC 함수 권한** (P0): `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`. §6-2.
> - **rate limit error/data 분기 (fail-closed)** (P0): DB 장애(error)→503, 한도 초과(data=false)→429. 저장소 장애 시 인증 함수가 무방비로 열리지 않게. §4-3.
> - **CORS Vary: Origin + OPTIONS/POST 흐름** (P0): origin별 응답 캐시 안전 + preflight(허용 204/미허용 403)/POST외 405 전체 흐름 명시. §4-3.
> - **rate limit IP salt** (P0→경량): `sha256(ip + RATE_LIMIT_SALT)`. IPv4 공간이 좁아 단순 해시는 역추적 쉬움. §4-3.
> - **moves DELETE 정책 제거** (P1): soft delete만 사용, 클라이언트 hard delete 기능 없음 → 권한 축소. §3.
> - **기존 정책명 넓게 DROP** (P1): ai_guide_cache/system_config/storage 정책 drift 대비 후보 DROP + 재시도 안전성. §3/§5.
> - **rate_limit_log(window_start) 인덱스** (P1): cleanup 효율. §4-3.
> - **signed URL guard 표현 정정** (P1): "3중 방어"→"조기 차단(클라)+최종 경계(Storage 정책)". §5-2.
> - **반영 안 함**: GPT 2차에서 "OK/수정 불필요"로 확인한 항목(JWT 추출, ownership 검증, increment RPC 구조, Storage UPDATE 없음 등) 그대로 유지.

> **Preflight 실측 반영 (구현 직전)**: §2 preflight를 실제 DB 조회로 실행한 결과 반영
>
> - **옛 정책명 / storage.foldername / FK CASCADE**: 추정대로 확인 — drift 없음, foldername 정상, auth.users 삭제 시 전체 CASCADE(§7 wipe 단순화).
> - **⭐ DEFINER RPC 소유권 누락 2건 발견 → 00020 신규**: `update_move_with_reschedule`(클라이언트 직접 호출인데 소유권 검증 없음 → 내부 EXISTS 가드 추가) + `apply_ai_guides`(Edge Function 전용인데 PUBLIC 노출 → service_role only). DEFINER가 RLS를 우회하므로 RLS 켜기 전 필수 보강. §2-1, §6.5, ADR-065.

---

## 0. 들어가기 전 (전제)

### 0-1. 10-1에서 넘어온 상태

- 모든 유저(익명·소셜)가 진짜 `auth.uid()` 보유 (JWT 인증 완료)
- `TEMP_USER_ID` 하드코딩 전면 제거됨 (grep 0건)
- service 함수 전건에 `userId` 파라미터 + `.eq('user_id', userId)` 적용 (checklist.ts 7개, photos.ts 7개, settings.ts RPC)
- 마이그레이션 00015로 RPC 소유권 검증 활성화 (`create_move_with_checklist` `auth.uid()` 체크, `update_move_with_reschedule` `p_user_id`/소유권 검증)
- **RLS는 아직 OFF** — 정책 SQL은 00003에 정의되어 있으나 `ENABLE` 안 됨. `auth_provider_links`만 10-1에서 ENABLE(정책 0개 = service_role only)
- prod Supabase 프로젝트 미생성 (10-1은 dev 전용, ADR-046)
- production Vercel은 dev Supabase에 임시 연결 중 (ADR-051)

### 0-2. 인증(10-1) vs 인가(10-2)

- **인증(Authentication)**: "누구인가" — 10-1에서 완료. 로그인/익명 sign-in으로 `auth.uid()` 발급.
- **인가(Authorization)**: "무엇에 접근 가능한가" — 10-2의 핵심. RLS가 `auth.uid()`를 재료로 행 단위 접근을 DB가 강제.
- 현재는 인가가 애플리케이션 코드(service 함수 필터)에만 존재 → 코드가 한 곳이라도 필터를 빠뜨리거나 anon key로 직접 쿼리하면 타 유저 데이터 노출. RLS는 이를 DB 엔진 차원에서 강제.

### 0-3. E(외부 공개) 분리 이유 — release-gate

- RLS 코드 완료와 외부 공개는 리스크 성격이 다름.
- 10-1 verify에서 미검증으로 남은 항목(디바이스 A/B 격리, 토큰 만료 재가입, Apple 실기기, Edge Function curl 405 등)은 외부 공개 게이트에서 막아야 할 운영·검증 항목이지 RLS 코드 완료 조건이 아님.
- 따라서 prod 외부 공개(환경변수 prod 스위치 + URL 공유)는 별도 release-gate(§11)로 분리.

---

## 1. 하는 것 / 안 하는 것

### 하는 것

- **(A) RLS 활성화**: 마이그레이션 00016에서 6개 테이블 `ENABLE`. `ai_guide_cache` public SELECT 정책 제거.
- **Preflight audit**: RLS 켜기 전 RPC `SECURITY DEFINER`/소유권 패턴, service 함수 null guard, Edge Function service_role 우회 점검.
- **(D) Edge Function 보안**: `generate-ai-guide` JWT 필수(익명 허용) + move 소유권 검증. `kakao-token-exchange` CORS origin 제한 + rate limit(DB 테이블).
- **(D) Storage 보안**: 경로 구조 `{moveId}/...` → `{userId}/{moveId}/...` 전환, `storage.objects` 표준 정책(첫 칸 = `auth.uid()`).
- **(B) 충돌 처리 RPC**: `migrate_anonymous_to_user` 정의 + backend contract + 테스트. 폴백 발동 로깅. 폴백 시 안내 배너(최소 상태).
- **(C) 데이터 wipe**: dev 사용자 데이터 전부 삭제(master_checklist_items + ai_guide_cache 보존). prod 0건 검증.
- **prod 생성 + 내부 smoke test**: 마이그레이션 일괄 적용, seed, RLS, 내부 검증.

### 안 하는 것

- **prod 외부 공개 / 환경변수 prod 스위치 / URL 공유** → release-gate (§11)
- **충돌 처리 정식 선택 UI(유지/교체/둘 다 보관)** → 10-3. 10-2는 RPC + contract + 테스트 + 안내 배너만.
- **RLS 통합 테스트 자동화(가짜 유저 격리 회귀 테스트)** → Follow-up (§11). 10-2는 손 체크리스트 + 수동 smoke test.
- **proactive token refresh** (10-1에서 401-driven으로 시작, 별도 단계)
- **익명 user 고아 데이터 정리(cleanup) 정책** (출시 운영 준비 단계)
- **Captcha / Turnstile** (출시 후 abuse 시)
- 사진 촬영/이사 완료 가입 유도 게이트, 계정 삭제, 네이티브 카메라 (10-3)

---

## 2. Preflight Audit — RLS 켜기 전 점검 (묶음 2) ⭐ 선행 필수

> RLS를 켜는 순간 service 함수·RPC·Edge Function·Storage 중 하나라도 `auth.uid()`와 어긋나면 그 기능이 통째로 깨진다. §3 진입 전에 아래 audit를 통과해야 한다. **자동화 스크립트는 만들지 않는다** (1인 프로젝트 오버엔지니어링). grep 명령어 + 사람이 직접 확인.

### 2-1. RPC `SECURITY DEFINER` / 소유권 패턴 점검

RPC는 두 종류로 `auth.uid()` 평가가 달라진다:

- **INVOKER**: 호출자 권한 실행 → `auth.uid()` = 호출자. RLS 그대로 적용.
- **DEFINER**: 함수 소유자 권한 실행 → **RLS 우회.** `auth.uid()`는 JWT 기준으로 정상 반환되지만, 행 접근 제한이 풀리므로 **함수 내부에서 명시적 소유권 검증 필수.**

**현재 RPC 목록 + 점검 기준:**

| RPC                           | SECURITY | 소유권 검증 (실측)                                                    | 판정                              |
| ----------------------------- | -------- | --------------------------------------------------------------------- | --------------------------------- |
| `create_move_with_checklist`  | DEFINER  | `p_user_id IS DISTINCT FROM auth.uid()` (00015)                       | ✅ OK                             |
| `update_move_with_reschedule` | DEFINER  | **누락** — `WHERE id = p_move_id`만, `user_id = auth.uid()` 검증 없음 | ⚠️ **구멍 — 00020에서 가드 추가** |
| `claim_ai_guide_generation`   | DEFINER  | 공용 캐시 자원 — 소유권 무관                                          | ✅ OK                             |
| `apply_ai_guides`             | DEFINER  | **누락** — `WHERE u.move_id = p_move_id`만, auth.uid() 검증 없음      | ⚠️ **구멍 — 00020에서 권한 좁힘** |

> **⭐ Preflight 실측 결과 (2026-xx-xx, 구현 전 점검 완료)**: `pg_policies`/`pg_proc`/FK 조회로 4개 항목 확인.
>
> - **옛 정책명**: DROP 후보 전부 일치, drift 0 (ai*cache_select_public / system_config_read_all / dev_allow_all*_ / _\_all_own 모두 확인). 스펙대로 진행.
> - **RPC SECURITY**: 4개 모두 DEFINER 확인. `!=` 잔존 0건. **단 2개에서 소유권 검증 누락 발견** (`update_move_with_reschedule`, `apply_ai_guides`) → §아래 + 00020.
> - **users↔auth.users FK**: `ON DELETE CASCADE` 확인. auth.users 삭제 → public.users → 하위 4개 테이블 전부 CASCADE 자동 삭제. wipe 절차 단순화 가능(§7).
> - **storage.foldername**: `[1]`이 첫 폴더(`{userId}`) 정확히 반환 확인. §5-2 정책 정상 동작.

> **⚠️ 발견된 RPC 소유권 구멍 2개 (DEFINER가 RLS를 우회하므로 치명적):**
>
> 1. **`update_move_with_reschedule`** — 클라이언트가 직접 호출하는 RPC(이사 정보 수정). 소유권 검증이 없어 **남의 moveId만 알면 그 사람 이사·체크리스트를 수정 가능.** 10-1에서 `create_move`에만 가드를 넣고 짝인 이 함수를 빠뜨림. → **함수 내부에 `create_move`와 동일한 소유권 가드 추가** (00020). service_role 전용으로 막을 수 없음(클라이언트가 직접 호출하는 정상 기능이라).
> 2. **`apply_ai_guides`** — Edge Function(service_role)만 호출하는 내부 RPC. §4-1에서 Edge Function이 호출 전 move 소유권을 검증하므로, **클라이언트 직접 호출만 막으면 됨** → `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO service_role` (00020). 함수 내부 검증은 Edge Function이 담당하므로 중복 불요.

**grep 점검 명령 (회귀 확인용):**

```bash
grep -rn "SECURITY DEFINER" supabase/migrations/   # DEFINER 함수 목록
grep -rn "auth.uid()" supabase/migrations/          # 소유권 검증 위치
grep -rn "p_user_id != " supabase/migrations/       # != 잔존 (IS DISTINCT FROM이어야)
```

**결정 사항**: DEFINER 함수는 "파라미터로 user_id 받되 `IS DISTINCT FROM auth.uid()`로 대조" 또는 "함수 내부 `EXISTS(... user_id = auth.uid())` 가드" 패턴. 클라이언트 직접 호출 RPC는 내부 가드, Edge Function 전용 RPC는 권한 좁힘. (메모리상 "DEFINER는 파라미터+소유권검증" 원칙 + ADR.)

### 2-2. service 함수 userId null guard 점검

RLS 켜면 service 함수의 `.eq('user_id', userId)`는 2차 방어가 된다(중복 안전). 단, **`userId`가 null로 넘어가면 에러 없이 0건 반환 → 빈 화면**. 사용자는 데이터 소실로 오인.

```bash
# .from() 호출 중 user_id 필터 없는 곳
grep -rn "\.from(" apps/web/src/services/
# userId 파라미터를 받는 함수에 null guard가 있는지 (호출부)
grep -rn "userId" apps/web/src/services/ | grep -v "eq('user_id'"
```

**점검 항목**: 모든 service 호출 경로(훅 → 페이지 → 컴포넌트)에서 `userId` null일 때 호출 자체를 막는 가드가 있는가. (10-1에서 PhotoRoomPage/PhotosPage/PhotoTrashPage에 guard 추가됨 — 나머지 경로 회귀 확인.)

> **v2 추가 — soft delete 필터 service 책임 확인**: RLS에서 `deleted_at` 조건을 뺐으므로(§3), active/deleted 구분은 service query가 책임진다. 일반 목록 조회에 `.is('deleted_at', null)`, 휴지통에 `.not('deleted_at', 'is', null)`이 있는지 grep으로 확인. 누락 시 RLS는 통과하지만 삭제된 행이 일반 목록에 섞여 나온다.
>
> ```bash
> grep -rn "deleted_at" apps/web/src/services/
> ```

### 2-3. Edge Function service_role 우회 점검

Edge Function이 service_role 키로 동작하면 **RLS를 전부 우회**한다. RLS가 막아줄 거라 믿고 검증을 생략하면 그 함수만 구멍이 된다.

| Edge Function          | service_role 사용 | 우회하는 RLS               | 내부 대체 검증                                                         |
| ---------------------- | ----------------- | -------------------------- | ---------------------------------------------------------------------- |
| `generate-ai-guide`    | O (supabaseAdmin) | user_checklist_items write | **move 소유권 검증** (§4-1) — JWT의 `auth.uid()`가 moveId의 소유자인지 |
| `kakao-token-exchange` | O (admin.auth)    | users/auth_provider_links  | JWT 검증(10-1 완료) + 매핑 PK (§4-3)                                   |

**점검 항목**: service_role로 도는 함수가 RLS를 우회하는 지점마다 함수 내부 검증이 대체하고 있는가. 표로 정리해 verify에 첨부.

---

## 3. RLS 활성화 (A — 묶음 1) — v2 전면 개정

> **v2 변경**: v1은 "00016에서 `ENABLE`만, 00003 정책 그대로 사용"이었으나, 00003 정책 중 `moves`/`property_photos`의 `FOR ALL ... AND deleted_at IS NULL`이 **soft delete 복구/영구삭제와 충돌**한다(휴지통 기능을 깨뜨림). 따라서 00016에서 충돌 정책을 **DROP 후 작업별(SELECT/INSERT/UPDATE/DELETE) 분리 재CREATE**하고, `deleted_at` 필터는 RLS에서 빼서 service query로 옮긴다. 적용된 00003 파일 자체는 수정하지 않고, 00016에서 DROP+재CREATE로 덮어쓴다(ADR-056).

### 3-0. soft delete + RLS 충돌 원리

`moves`/`property_photos`는 soft delete(`deleted_at` 컬럼)를 쓴다. 00003 정책이 `FOR ALL USING (auth.uid() = user_id AND deleted_at IS NULL)`이면:

- soft delete된 행(`deleted_at IS NOT NULL`)이 RLS에서 **안 보임** → 휴지통 목록 조회 불가
- 복구 `UPDATE ... SET deleted_at = NULL`이 대상 행을 못 봐서 **0건 처리**
- 영구삭제 `DELETE`도 대상 행을 못 봐서 실패

우리는 PhotoTrashPage에서 복구·영구삭제를 실제로 한다(STATUS 198행). 따라서 **RLS는 소유권(`auth.uid() = user_id`)만 강제하고, active/deleted 필터는 service query에서 처리**한다.

### 3-1. 마이그레이션 `00016_enable_rls.sql`

```sql
-- ============ RLS ENABLE (7개 테이블) ============
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_guide_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;  -- §3-2 (5)

-- ============ users: SELECT만 (UPDATE도 닫음 — v3) ============
-- public.users는 handle_new_user 트리거(00013)가 생성. 클라이언트 직접 INSERT/DELETE 불요.
-- ⭐ v3: UPDATE도 닫는다. RLS는 행 단위라 컬럼을 못 막는데, users.provider는
--    migrate_anonymous_to_user의 anonymous 판정에 쓰이는 보안성 컬럼이다(§6-2).
--    users_update_own을 열면 클라이언트가 자기 provider를 위조해 그 검증을 우회할 수 있다.
--    따라서 provider/email 등 상태성 필드는 트리거/Edge Function/service_role만 갱신.
DROP POLICY IF EXISTS "users_all_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;  -- 혹시 만들었으면 제거
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated USING (auth.uid() = id);
-- UPDATE/INSERT/DELETE 정책 없음 = 클라이언트 불가
-- (display_name 등 유저 편집 컬럼이 생기면 컬럼 화이트리스트 update_profile RPC로 — Follow-up)

-- ============ moves: deleted_at을 RLS에서 제거, 소유권만 (DELETE 제외 — v3) ============
-- ⭐ v3: moves는 soft delete만 사용. 클라이언트 hard delete 기능 없음 → DELETE 정책 미생성.
--    hard delete(계정 삭제/cleanup)는 10-3에서 service_role/RPC로 처리.
DROP POLICY IF EXISTS "moves_all_own" ON public.moves;
DROP POLICY IF EXISTS "moves_delete_own" ON public.moves;  -- 혹시 만들었으면 제거
CREATE POLICY "moves_select_own" ON public.moves
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "moves_insert_own" ON public.moves
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "moves_update_own" ON public.moves
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- DELETE 정책 없음 = 클라이언트 hard delete 불가 (soft delete는 UPDATE로 처리)

-- ============ property_photos: deleted_at을 RLS에서 제거, 소유권만 (DELETE 유지) ============
-- 휴지통 영구삭제 기능이 실제 존재하므로 DELETE 정책 유지.
DROP POLICY IF EXISTS "photos_all_own" ON public.property_photos;
CREATE POLICY "photos_select_own" ON public.property_photos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "photos_insert_own" ON public.property_photos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "photos_update_own" ON public.property_photos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "photos_delete_own" ON public.property_photos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ user_checklist_items: 소유권만 (deleted_at 없음, FOR ALL 유지 가능) ============
-- 00003의 user_checklist_all_own (auth.uid() = user_id)이 soft delete와 무관하므로 그대로 둠.
-- (명시적 재작성이 필요하면 동일 패턴으로 분리 가능 — 충돌 없으니 v2에선 유지)

-- ============ master_checklist_items: anon/authenticated 모두 SELECT 공개 ============
-- 00003의 master_select_public (USING true)은 role 무관 → anon/authenticated 모두 통과. 유지.
-- INSERT/UPDATE/DELETE 정책 없음 = service_role only.

-- ============ ai_guide_cache: public SELECT 제거 → service_role only (§4-2) ============
-- v3: 7단계 정책명 drift 대비 후보 넓게 DROP (실제명은 pg_policies 조회 후 확정)
DROP POLICY IF EXISTS "ai_cache_select_public" ON public.ai_guide_cache;
DROP POLICY IF EXISTS "ai_guide_cache_read_all" ON public.ai_guide_cache;
DROP POLICY IF EXISTS "ai_guide_cache_select_public" ON public.ai_guide_cache;
-- 정책 0개 = service_role만 접근. 클라이언트는 캐시를 직접 읽지 않음.

-- ============ system_config: public SELECT, write는 service_role (§3-2) ============
-- v3: 7단계 정책명 drift 대비 후보 넓게 DROP
DROP POLICY IF EXISTS "system_config_read_all" ON public.system_config;
DROP POLICY IF EXISTS "system_config_select_public" ON public.system_config;
CREATE POLICY "system_config_select_public" ON public.system_config
  FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE 정책 없음 = service_role only.
```

> `auth_provider_links`는 10-1(00014)에서 이미 ENABLE + 정책 0개(service_role only). 재실행 불요.
> `rate_limit_log`는 §4-3(00018)에서 ENABLE + 정책 0개.

### 3-2. 테이블별 정책 (00016 적용 후 최종)

| 테이블                   | 정책                            | 접근 규칙              | 비고                                                             |
| ------------------------ | ------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| `users`                  | select_own                      | `auth.uid() = id`      | (1) **SELECT만** — UPDATE/INSERT/DELETE 불허(provider 위조 차단) |
| `moves`                  | select/insert/update_own        | `auth.uid() = user_id` | (2) `deleted_at` RLS에서 제거 + **DELETE 없음**(soft delete만)   |
| `master_checklist_items` | master_select_public            | `SELECT USING (true)`  | (3) anon/authenticated 모두 SELECT. write 불가                   |
| `user_checklist_items`   | user_checklist_all_own          | `auth.uid() = user_id` | soft delete 미사용 → 유지                                        |
| `property_photos`        | select/insert/update/delete_own | `auth.uid() = user_id` | (4) `deleted_at` RLS에서 제거. DELETE 유지(휴지통 영구삭제)      |
| `ai_guide_cache`         | (정책 0개)                      | service_role only      | 클라이언트 직접 SELECT 불가                                      |
| `system_config`          | system_config_select_public     | `SELECT USING (true)`  | (5) public read, write service_role                              |
| `auth_provider_links`    | (정책 0개)                      | service_role only      | 00014에서 ENABLE                                                 |
| `rate_limit_log`         | (정책 0개)                      | service_role only      | 00018에서 ENABLE                                                 |

> **(1) users 보안성 컬럼**: `provider`는 §6-2 anonymous 판정에 쓰이는 보안성 컬럼. RLS는 컬럼을 못 막으므로 UPDATE 자체를 닫아 위조 차단. 유저 편집 컬럼(display_name 등)이 생기면 컬럼 화이트리스트 RPC로(Follow-up).
> **(2) moves DELETE 없음**: 클라이언트 hard delete 기능 미존재. soft delete는 UPDATE(`deleted_at` 세팅)로 처리. hard delete는 10-3 계정삭제에서 service_role.

> **(2)(4) service query 책임 이동**: active/deleted 필터를 service에서 처리.
>
> - 일반 목록: `.eq('user_id', userId).is('deleted_at', null)`
> - 휴지통: `.eq('user_id', userId).not('deleted_at', 'is', null)`
> - 복구(soft delete 되돌리기): `.eq('user_id', userId).update({ deleted_at: null })`
> - moves soft delete: `.eq('user_id', userId).update({ deleted_at: now })` (DELETE 아님)
>
> 6단계 서비스 코드가 이미 `deleted_at` 필터를 넣고 있는지 §2-2 grep으로 확인. 누락 시 추가.

### 3-3. 익명 유저 RLS 동작

- `auth.uid()`는 익명 유저도 정상 반환(익명도 JWT 보유). 비회원 우선 전략의 핵심.
- 익명 세션 본인 데이터 CRUD 정상, 디바이스 B 익명 세션은 서로 다른 `auth.uid()`라 격리.
- 모든 정책이 `TO authenticated`이므로 익명(authenticated role) 통과, anon role(미로그인)은 차단. master_checklist_items/system_config만 `USING(true)`로 anon도 SELECT 가능.
- → §10 verify에 "익명 세션 본인 CRUD + 디바이스 B 격리" 명시.

---

## 4. Edge Function 보안 (D 일부 — 묶음 4)

### 4-1. `generate-ai-guide`: JWT 필수(익명 허용) + move 소유권 검증

**JWT 필수 — 비용 폭탄(denial of wallet) 방어:**

- AI 호출은 비용 발생. 함수 URL은 클라이언트 코드에 노출되어 사실상 공개 → 토큰 없는 외부 호출로 비용 폭주 가능.
- `verify_jwt: true`(Supabase 기본값) 유지. JWT 없는 호출은 401로 차단되어 AI 호출 이전에 막힘.
- **논리 근거 (중요)**: DECISIONS §4-2는 원래 "AI 가이드는 인증 불필요(비회원 사용)"였다. 그러나 10-1 익명 sign-in 도입으로 **비회원 = 익명 JWT 보유**가 되었으므로, "JWT 필수"로 걸어도 비회원이 막히지 않는다. anonymous=무토큰 전제가 깨졌으므로 JWT 필수가 비회원 우선 전략과 모순되지 않는다.

**move 소유권 검증 — 위치 정밀화:**

- 캐시(`ai_guide_cache`) 조회/생성은 `housing_type+contract_type+move_type` 키 기반 **공용 자원** → 소유권 무관.
- 검증이 필요한 지점은 결과를 `user_checklist_items.custom_guide`에 **쓸 때**(apply): 이 moveId가 JWT의 `auth.uid()` 소유인가.
- 현재 구조(ADR-018): 함수가 moveId만 받아 moves를 직접 조회. → **moves 조회 시점에 `user_id = auth.uid()` 확인**을 추가. 불일치 시 403, custom_guide write 진입 금지.
- service_role로 RLS를 우회하므로 이 내부 검증이 RLS를 대체한다.

**JWT user 추출 — anon client `auth.getUser()` 방식 (v2 구체화):**

> 구현자가 JWT를 직접 decode하지 않는다. Authorization 헤더를 그대로 단 anon client로 `auth.getUser()`를 호출해 Supabase가 서명 검증까지 하게 한다.

```typescript
// 1) Authorization 헤더 확인
const authHeader = req.headers.get('Authorization')
if (!authHeader?.startsWith('Bearer ')) {
  return json({ error: 'unauthorized' }, 401, req) // json()은 CORS 적용 헬퍼 (§4-3)
}

// 2) anon client로 JWT 검증 + user 추출 (직접 decode 금지)
const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
  global: { headers: { Authorization: authHeader } },
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: userData, error: userErr } = await userClient.auth.getUser()
if (userErr || !userData.user) {
  return json({ error: 'unauthorized' }, 401, req)
}
const jwtUserId = userData.user.id

// 3) service_role(admin)로 move 조회 + 소유권 + cacheKey 재료를 서버에서 확보
//    ⭐ 클라이언트가 보낸 conditions/items는 신뢰하지 않는다. moveId만 받는다.
const { data: move } = await supabaseAdmin
  .from('moves')
  .select('user_id, housing_type, contract_type, move_type')
  .eq('id', moveId)
  .single()
if (!move || move.user_id !== jwtUserId) {
  return json({ error: 'forbidden' }, 403, req)
}

// 4) cacheKey는 서버가 조회한 move 조건으로만 생성 (캐시 포이즈닝 방지)
const cacheKey = buildCacheKey(move.housing_type, move.contract_type, move.move_type)
// 이후 캐시 조회/생성 → apply_ai_guides (이 move에만 write)
```

> **cache key 무결성**: cacheKey 재료(housing/contract/move_type)를 클라이언트 payload가 아니라 **소유권 검증된 move row에서 직접 조회**한다. 클라이언트가 조건을 위조해 캐시를 오염시키는 것(cache poisoning) 차단. (ADR-018 + 메모리상 알려진 공격 벡터.)

### 4-2. `ai_guide_cache`: service_role only 전환

- 00016에서 `ai_cache_select_public` 정책 제거(§3-1). RLS ENABLE + 정책 0개 = service_role만 접근.
- 클라이언트는 캐시를 직접 읽지 않고 `user_checklist_items.custom_guide`만 읽는다. 캐시는 Edge Function 내부 구현 디테일로 은닉(관심사 분리).
- **회귀 점검**: 클라이언트 코드에서 `ai_guide_cache`를 직접 SELECT하는 곳이 없는지 grep.

```bash
grep -rn "ai_guide_cache" apps/web/src/
```

### 4-3. `kakao-token-exchange`: CORS origin 제한 + rate limit

10-1에서 완료: JWT 검증, POST only(405), orphan rollback, 매핑 PK 조회. 10-2 추가:

**CORS origin 제한 — 실제 reject (v2 수정):**

> v1은 `allowOrigin = includes ? origin : ALLOWED[0]`로 미허용 origin에 첫 origin을 돌려주는 무의미한 코드였다. v2는 미허용 시 **403 reject**한다. CORS는 보안 경계가 아니라 브라우저 오남용을 줄이는 보조 장치 — 실제 보안은 JWT + rate limit + ownership이 담당.

```typescript
const ALLOWED_ORIGINS = [
  'https://isakok-dev.vercel.app',
  'https://isakok.vercel.app',
  // 로컬 dev 빌드 한정: 'http://localhost:5173'
]

// null → 네이티브/서버 호출 (Origin 없음, 허용), 'DENY' → 차단
function resolveCorsOrigin(req: Request): string | null | 'DENY' {
  const origin = req.headers.get('Origin')
  if (!origin) return null // WebView/네이티브: Origin 없음
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  return 'DENY'
}

const resolved = resolveCorsOrigin(req)

// 1) 미허용 origin은 OPTIONS/POST 무관하게 즉시 403 (v3)
if (resolved === 'DENY') {
  return new Response(JSON.stringify({ error: 'origin not allowed' }), {
    status: 403,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'null',
      Vary: 'Origin',
    }, // v3: Vary
  })
}

// 2) 허용/네이티브 공통 CORS 헤더 (Vary: Origin 포함 — origin별 응답이 달라지므로 캐시 안전)
const corsHeaders = {
  'Access-Control-Allow-Origin': resolved ?? 'null', // Origin 없는 호출엔 'null' (의도: 아래 주석)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
}

// 3) preflight: 허용 origin OPTIONS는 204
if (req.method === 'OPTIONS') {
  return new Response(null, { status: 204, headers: corsHeaders })
}

// 4) POST 외 method는 405
if (req.method !== 'POST') {
  return json({ error: 'method not allowed' }, 405, req, corsHeaders)
}
```

> **`Access-Control-Allow-Origin: 'null'` 의도 (v3)**: Origin이 없는 요청(네이티브/서버-투-서버)은 브라우저 CORS 대상이 아니므로 ACAO 값의 실질 의미가 작다. helper 일관성을 위해 `'null'`을 넣지만, 이 경로의 실제 보안은 Authorization JWT + rate limit이 담당한다. CORS는 브라우저 오남용을 줄이는 보조 장치일 뿐 보안 경계가 아니다.
> **WebView(네이티브) 처리**: WebView는 `functions.invoke`로 호출하며 Origin이 없을 수 있다(`null` 분기 → 허용). Authorization JWT가 보안을 담당하므로 구멍을 만들지 않음. 구현 시 네이티브 호출 Origin 실측 확인.
> **IP 추출 기준**: `x-forwarded-for` 첫 값 우선 → `cf-connecting-ip` → `x-real-ip`. 모두 없으면 IP bucket 스킵, user bucket만 적용.

**rate limit — DB 테이블 + 원자적 increment RPC (v2 보강):**

- Edge Function은 stateless → 호출 횟수를 외부에 기록. **(A) DB 테이블 채택**(vs Redis, ADR-058).
- 제한: anonymous user 분당 5회 + IP 시간당 30회.
- **v2 추가**: 테이블만 두고 select→update하면 race condition. `ON CONFLICT DO UPDATE RETURNING`으로 **원자적 increment RPC**를 둔다.
- **IP는 평문 저장 금지** → SHA-256 해시. 보존 24~48h.

```sql
-- 00018_rate_limit.sql
CREATE TABLE public.rate_limit_log (
  bucket_key text NOT NULL,        -- "kakao:user:<uid>" 또는 "kakao:ip:<sha256(ip+salt)>"
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key, window_start)
);
-- v3: cleanup이 window_start 단독 조건으로 돌므로 보조 인덱스 추가
CREATE INDEX idx_rate_limit_log_window_start ON public.rate_limit_log (window_start);
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;  -- 정책 0개 = service_role only

-- 원자적 증가 + 한도 판정 (true = 허용, false = 초과)
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_bucket_key text,
  p_window_start timestamptz,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.rate_limit_log (bucket_key, window_start, count)
  VALUES (p_bucket_key, p_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = public.rate_limit_log.count + 1
  RETURNING count INTO v_count;

  -- lazy cleanup (오래된 window 삭제)
  DELETE FROM public.rate_limit_log WHERE window_start < now() - interval '2 days';

  RETURN v_count <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_rate_limit FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit TO service_role;
```

```typescript
// Edge Function: window을 분/시간 단위로 truncate해서 RPC 호출
const userWindow = truncateToMinute(new Date()) // 분당 5회
const ipWindow = truncateToHour(new Date()) // 시간당 30회

// v3: IP는 salt 해시 (IPv4 공간이 좁아 단순 sha256은 역추적 쉬움)
const salt = Deno.env.get('RATE_LIMIT_SALT') ?? ''
const ipHash = clientIp ? await sha256(`${clientIp}:${salt}`) : null

// v3: error(DB 장애)와 data=false(한도 초과)를 구분 — fail-closed
const userResult = await admin.rpc('increment_rate_limit', {
  p_bucket_key: `kakao:user:${jwtUserId}`,
  p_window_start: userWindow,
  p_limit: 5,
})
if (userResult.error) {
  // 저장소 장애 → 닫음 (인증 함수가 무방비로 열리면 안 됨)
  console.error('[rate-limit:user]', userResult.error)
  return json({ error: 'rate limit unavailable' }, 503, req)
}
if (!userResult.data) {
  // 한도 초과
  return json({ error: 'rate limited' }, 429, req)
}

if (ipHash) {
  // IP 추출 실패 시 IP bucket 스킵, user bucket만
  const ipResult = await admin.rpc('increment_rate_limit', {
    p_bucket_key: `kakao:ip:${ipHash}`,
    p_window_start: ipWindow,
    p_limit: 30,
  })
  if (ipResult.error) {
    console.error('[rate-limit:ip]', ipResult.error)
    return json({ error: 'rate limit unavailable' }, 503, req)
  }
  if (!ipResult.data) {
    return json({ error: 'rate limited' }, 429, req)
  }
}
```

> **v3 — fail-closed**: rate limit 저장소(DB)가 죽으면 503으로 닫는다. 인증 엔드포인트의 rate limit이 조용히 무력화되면 비용 폭주 방어가 풀리므로, 장애 시 열어두지 않고 차단하는 게 안전.
> **IP salt**: `RATE_LIMIT_SALT`를 Supabase secret으로 관리(`supabase secrets set RATE_LIMIT_SALT=<random>`). 평문 IP 저장 금지 + 단순 해시 역추적 방지.

---

## 5. Storage 정책 (D 일부 — 묶음 5)

### 5-1. 경로 구조 변경 (`{moveId}/...` → `{userId}/{moveId}/...`) — B안 채택

- **현재 실제 코드 (photos.ts:97)**: `{moveId}/{photoType}/{room}_{timestamp}.{ext}` — user_id 없음. 6단계에서 GPT 보완 #3을 받아 "userId 의존 제거, moveId 기반"으로 _의도적으로_ 채택(인증 도입 시 마이그레이션 회피 목적). → **이는 버그가 아니라 의도된 설계.** (GPT v2 리뷰가 "6단계는 이미 userId였다"고 한 것은 사실과 다름 — 결론은 같으나 전제만 틀림.)
- **변경**: `{userId}/{moveId}/{room}_{timestamp}.{ext}` — 첫 칸 user_id.
- **`photoType` segment 제거 (v2)**: 입주/퇴실 구분은 DB `photo_type` 컬럼이 담당. Storage 정책은 첫 segment(userId)만 보므로 photoType은 경로에 불필요. 경로 단순화. (path format v2가 필요하면 v1.1로.)
- **이유**: 인증 도입(=지금)이 6단계 단서의 조건. 표준 Storage 정책("경로 첫 칸 = `auth.uid()`")을 걸려면 경로에 user_id가 있어야 한다. 서브쿼리 정책(경로 moveId → moves 조회) 대비 단순·고속·표준.
- **마이그레이션 부담 없음**: 기존 사진은 전부 테스트 데이터로 §7 wipe에서 삭제. wipe 선행 → 새 경로 적용 → 새로 적재. prod는 처음부터 새 구조. → 기존 사진 이전 작업 0.
- photos.ts:97 경로 생성 로직 + 주석 갱신("인증 도입 완료로 user_id 기반 표준 정책 채택, photoType은 DB 컬럼이 담당").

> **컬럼명 확인 (v2, 이미 해결로 추정)**: 파일 경로 컬럼은 `storage_path`로 통일됨(1단계에서 `storage_path text NOT NULL`로 생성, `image_url` 미사용). GPT가 `image_url` 잔존 가능성을 제기했으나 이미 해결된 사항. 안전 차원에서 grep 1회만 확인:
>
> ```bash
> grep -rn "storage_path\|image_url" supabase/migrations apps/web/src packages/shared/src
> ```
>
> `image_url`이 어디서도 안 나오면 추가 작업 없음.

### 5-2. `storage.objects` 표준 정책

**v2 추가 — 기존 dev permissive policy 먼저 제거:**

> 6단계는 RLS 없이 개발했으므로 storage에 dev용 allow-all 정책이 남아 있을 수 있다. 새 정책을 추가하기 **전에 기존 permissive policy를 조회해 DROP**한다. 안 지우면 새 정책과 무관하게 구멍이 그대로 남는다.

```sql
-- 1) 기존 storage 정책 조회 (정확한 정책명 확인 후 DROP)
SELECT policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';

-- 2) dev permissive 정책 DROP (정책명은 위 조회 결과에 맞춰 정정)
DROP POLICY IF EXISTS "dev_allow_all_upload" ON storage.objects;
DROP POLICY IF EXISTS "dev_allow_all_select" ON storage.objects;
DROP POLICY IF EXISTS "dev_allow_all_update" ON storage.objects;
DROP POLICY IF EXISTS "dev_allow_all_delete" ON storage.objects;
```

**본인 경로 정책 (00017):**

```sql
-- 00017_storage_policy.sql
-- v3: 재시도 안전성 + 정책명 drift 대비 — 새 정책명도 DROP 후 CREATE
DROP POLICY IF EXISTS "photos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "photos_delete_own" ON storage.objects;

-- property-photos 버킷: 경로 첫 칸(폴더)이 본인 auth.uid()인 객체만 허용
-- (storage.foldername(name))[1] = 경로 첫 세그먼트 = {userId}

CREATE POLICY "photos_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "photos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "photos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- UPDATE 정책 없음 (의도) — 아래 참조
```

> **UPDATE 정책 미생성 (v2 명시)**: 사진 파일은 업로드 후 수정하지 않는다. 수정이 필요하면 기존 object 삭제 후 새 object 업로드. Storage upload는 `upsert: false` 유지. (upsert/metadata 변경이 필요해지면 그때 photos_update_own 추가.)

- 버킷 `property-photos`는 private 유지(공개 금지). DB에는 `storage_path`만 저장.
- signed URL 발급(`createSignedUrls`)은 SELECT 정책을 통과해야 가능 → 본인 경로만 발급. (앱에서 anon key로 직접 발급하는 현 방식이 정책으로 보호됨.)
- SIGNED_URL_EXPIRY_SEC=3600 + staleTime 30분 재발급 흐름 유지.

> `(storage.foldername(name))[1]`이 첫 폴더(`{userId}`)를 반환하는지 구현 시 실측 확인. Supabase 버전별 함수 시그니처 차이 가능.

**signed URL ownership 가드 (v2, 배치 성능 유지하며 보강):**

> GPT는 `getSignedUrl(storagePath)` → `getSignedUrlByPhotoId(photoId)` 전면 교체를 제안했으나, 우리는 `createSignedUrls`로 **여러 장을 배치 발급**한다(useSignedUrls 훅). photoId 기반으로 바꾸면 N장에 N번 DB 조회가 생겨 배치 이점이 사라진다. → 경로 직접 입력은 유지하되 **클라이언트 측 ownership 가드**를 추가. Storage SELECT 정책(본인 경로만)이 이미 1차 방어이므로, 이 가드는 임의 경로 시도를 조기 차단하는 보조 방어.

```typescript
// createSignedUrls 호출 전, 모든 path가 본인 prefix인지 확인
for (const path of storagePaths) {
  if (!path.startsWith(`${userId}/`)) {
    throw new Error('[createSignedUrls] storagePath ownership mismatch')
  }
}
```

> **방어 계층 (v3 표현 정정)**: prefix 가드는 **클라이언트 단 조기 차단**일 뿐, 최종 보안 경계는 **Storage SELECT 정책**(본인 경로만 발급)이다. 가드는 우회 가능(클라이언트 코드)하므로 "보장"이 아니라 "조기 차단"으로 이해. 계층: ① 클라이언트 prefix 가드(조기 차단) → ② Storage SELECT 정책(실제 경계) → ③ 버킷 private.
> **배치 혼합 결과**: `createSignedUrls`에 본인/타인 경로를 섞으면 타인 경로는 정책에 막혀 실패/null. 혼합 시 부분 실패 처리(null 항목 skip)를 §10 verify에서 실측.

### 5-3. 실행 순서 의존성

> ⚠️ 문서 읽는 순서(§3 RLS → §5 Storage)와 **실제 실행 순서가 다르다.** 실제: **§7 wipe(사진 삭제) → §5-1 경로 변경 적용 → 새로 적재.** wipe 전에 경로만 바꾸면 기존 사진(옛 경로)이 새 정책에 막혀 접근 불가가 된다. dev는 wipe 선행 필수. prod는 빈 상태 생성이라 무관.

---

## 6. 충돌 처리 RPC (B — 묶음 3)

### 6-1. 발동 전제 — 폴백 전용 안전망

- spike 통과(2026-05-20)로 **메인 경로 = `linkIdentity`**: 익명 user.id 유지 → 데이터가 그대로 따라옴 → **마이그레이션 불필요.**
- `migrate_anonymous_to_user`는 **폴백 경로(`signInWithIdToken`로 새 user 생성)가 발동한 경우에만** 쓰는 안전망. 평소엔 호출되지 않음.
- → 스펙·코드에 "메인 경로엔 이 RPC를 호출하지 않는다"를 명시(혼란 방지).

### 6-2. `migrate_anonymous_to_user` 정의 + contract

> 10-2는 **정의 + backend contract + 테스트까지만.** 실제 호출(데이터 이동)은 10-3 선택 UI에서. 10-2에서 자동 호출하지 않는다(자동 호출 = 자동 병합이라 "조용한 병합 금지" 원칙 위반).

```sql
-- 00019_migrate_anonymous.sql
-- 익명 user(source)의 데이터를 새 user(target=호출자)로 이전. 폴백 경로 전용.
-- ⚠️ 10-2는 conflict contract placeholder다. keep_target(no-op)만 허용하고
--    나머지 전략은 명시적으로 막는다. 실제 데이터 이전은 10-3에서 구현.
CREATE OR REPLACE FUNCTION public.migrate_anonymous_to_user(
  p_anonymous_user_id uuid,
  p_strategy text DEFAULT 'keep_target'   -- 'keep_target' | 'replace_with_source' | 'keep_both'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_user_id uuid := auth.uid();   -- 호출자 = 이전받을 새 user
BEGIN
  -- 권한: 호출자만 자기 계정으로 이전 가능
  IF v_new_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: no auth context';
  END IF;
  IF p_anonymous_user_id = v_new_user_id THEN
    RAISE EXCEPTION 'invalid: source and target are identical';
  END IF;

  -- v2: source가 진짜 anonymous user인지 검증 (임의 user id 주입 차단)
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_anonymous_user_id AND provider = 'anonymous'
  ) THEN
    RAISE EXCEPTION 'invalid: source user is not anonymous';
  END IF;

  -- v2: 10-2에서는 keep_target(no-op)만 허용. 나머지 전략은 미구현 → 명시적 예외
  IF p_strategy IS DISTINCT FROM 'keep_target' THEN
    RAISE EXCEPTION 'strategy % is not implemented in 10-2 (see 10-3)', p_strategy;
  END IF;

  -- keep_target: 새 계정 데이터 유지, 익명 데이터는 건드리지 않음 (명시적 no-op)
  -- replace_with_source / keep_both 의 실제 데이터 이동은 10-3에서 UI와 함께 구체화.
  RETURN jsonb_build_object('migrated', false, 'strategy', 'keep_target');
END;
$$;

-- v3: 함수 권한 명시 (PUBLIC EXECUTE 기본 노출 차단)
REVOKE ALL ON FUNCTION public.migrate_anonymous_to_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrate_anonymous_to_user(uuid, text) TO authenticated;
```

> **v2 변경**: ① `provider = 'anonymous'` 검증으로 임의 user id 주입 차단. ② `keep_target` 외 전략은 `RAISE EXCEPTION`으로 막아, 이름과 다르게 조용히 no-op하는 오작동 방지. (10-2에서 `replace_with_source`를 호출하면 즉시 에러 → "구현 안 됨"이 명확히 드러남.)
> **v3 — provider 신뢰 전제**: 이 검증은 `public.users.provider`를 신뢰한다. 따라서 **클라이언트가 provider를 수정할 수 없어야** 한다 — §3에서 `users_update_own`을 제거(SELECT only)한 것이 이 전제를 떠받친다. 만약 users UPDATE를 열면 클라이언트가 자기 provider를 `'anonymous'`로 위조해 이 검증을 우회할 수 있다(두 결정이 한 쌍).
> **provider 갱신 전제**: source가 anonymous인지 판정하려면 linkIdentity/소셜 승격 후 `public.users.provider`가 정확히 갱신돼야 함. 10-1 트리거(`handle_user_provider_update`, ADR-054)가 담당. §10 verify에서 provider 갱신 실측 확인.

### 6-3. 최소 상태 (안내 배너) + 폴백 로깅

- 폴백 발동 시(linkIdentity 실패 → signInWithIdToken으로 새 user): 기존(새) 계정 그대로 사용 가능 + **"이전에 작성한 내용을 옮기는 기능은 곧 제공돼요" 안내 배너** 1개만. 거창한 선택 UI 없음.
- **폴백 발동률 로깅**: linkIdentity 실패 → 폴백 진입 시 기록(Edge Function 로그 또는 가벼운 카운트 테이블). 10-3 UI 우선순위 판단 근거(ADR-050 예고분).

### 6-4. 테스트

- `migrate_anonymous_to_user` 시그니처/권한 가드 단위 테스트:
  - `auth.uid()` 없으면 예외
  - source == target이면 예외
  - source가 anonymous가 아니면 예외 (v2)
  - `keep_target` 호출 시 데이터 변화 없음(no-op) 확인
  - `replace_with_source` / `keep_both` 호출 시 `not implemented` 예외 (v2)
- 폴백 로깅 동작 테스트(발동 시 카운트 증가).

### 6-5. 10-3 실제 이전 시 권한 증명 (메모)

> 10-3에서 `replace_with_source`/`keep_both`의 실제 데이터 이동을 구현할 때는, 새 user가 임의의 anonymous user id를 넣는 것을 막기 위해 **source ↔ target 관계 증명**이 필요하다(migration_token 또는 `auth_provider_conflicts` 테이블에 폴백 발동 시점의 (source, target) 쌍을 기록). 10-2의 `migrate_anonymous_to_user`는 `keep_target` no-op만 허용하므로 데이터 이전 권한 문제를 만들지 않는다. → Follow-up (§11).

---

## 6.5. 기존 RPC 소유권 보강 (00020) — Preflight 발견 사항 ⭐

> **§2 preflight 실측에서 발견**: DEFINER RPC 2개에 소유권 검증이 누락되어 있었다. DEFINER는 RLS를 우회하므로, RLS를 켜는 10-2에서 이 둘을 막지 않으면 **남의 데이터에 접근 가능한 구멍**이 그대로 노출된다. RLS 정책 변경(00016)과 성격이 달라(함수 본문 재정의/권한) 별도 마이그레이션 00020으로 분리.

### 6.5-1. `update_move_with_reschedule` 소유권 가드 추가

- **문제**: 클라이언트가 직접 호출하는 이사 정보 수정 RPC인데 소유권 검증이 없음(`WHERE id = p_move_id`만). 10-1에서 짝인 `create_move_with_checklist`에만 가드를 넣고 빠뜨림. → 남의 moveId만 알면 그 사람 이사·체크리스트 수정 가능.
- **수정**: 함수 시작부에 소유권 가드. 클라이언트 직접 호출 정상 기능이라 service_role 전용으로 막을 수 없으므로 **내부 가드** 방식.

```sql
-- 00020_rpc_ownership_guard.sql
-- update_move_with_reschedule: 함수 시작부에 소유권 가드 추가 (CREATE OR REPLACE)
-- (전체 본문은 기존 00003/00015 정의를 가져오되, 아래 가드를 BEGIN 직후에 삽입)
CREATE OR REPLACE FUNCTION public.update_move_with_reschedule(/* 기존 시그니처 유지 */)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ⭐ 추가: 소유권 가드 (DEFINER가 RLS 우회하므로 내부 검증 필수)
  IF NOT EXISTS (
    SELECT 1 FROM public.moves
    WHERE id = p_move_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized: move not owned by caller';
  END IF;

  -- ... 기존 로직 (이사 정보 UPDATE + 미완료 항목 재계산 + 조건 변경 항목 추가/삭제) ...
END;
$$;
```

> 시그니처에 `p_user_id`가 없으므로 `auth.uid()`를 직접 사용하는 `EXISTS` 가드가 적절(파라미터 추가보다 단순). `create_move`는 INSERT 시점 행 부재라 파라미터+대조를 썼지만, update는 기존 행이 있으므로 EXISTS로 소유권 확인 가능.

### 6.5-2. `apply_ai_guides` 권한 좁힘

- **문제**: Edge Function(service_role) 전용 RPC인데 PUBLIC EXECUTE가 열려 있어 클라이언트가 직접 호출 가능. auth.uid() 검증도 없음.
- **수정**: §4-1에서 Edge Function이 호출 전 move 소유권을 검증하므로, **클라이언트 직접 호출만 차단**하면 됨. 함수 본문 수정 없이 권한만 좁힘.

```sql
-- apply_ai_guides: Edge Function(service_role) 전용으로 권한 제한
REVOKE ALL ON FUNCTION public.apply_ai_guides(/* 기존 시그니처 */) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_ai_guides(/* 기존 시그니처 */) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ai_guides(/* 기존 시그니처 */) TO service_role;
```

> `claim_ai_guide_generation`도 Edge Function 전용이면 동일하게 권한 좁힘 검토(공용 캐시 자원이라 소유권은 무관하나, 클라이언트 직접 호출을 막는 게 일관적). 구현 시 호출 경로 확인 후 결정.

---

## 7. 데이터 wipe + prod 세우기 (C — 묶음 6)

### 7-1. dev wipe — 보존/삭제 대상

| 대상                                       | 처리                                              |
| ------------------------------------------ | ------------------------------------------------- |
| `moves`                                    | 삭제 (전부 테스트)                                |
| `user_checklist_items` (custom_guide 포함) | 삭제                                              |
| `property_photos` (DB 행)                  | 삭제                                              |
| Storage `property-photos` 버킷 파일        | 삭제                                              |
| `auth_provider_links`                      | 삭제 (테스트 매핑)                                |
| `rate_limit_log`                           | 삭제 (테스트 카운트)                              |
| `auth.users` (테스트 계정)                 | **삭제 (v2 확정)**                                |
| `public.users`                             | **cascade 확인 후 잔여 삭제 (v2)**                |
| `master_checklist_items` (46개)            | **보존** (마스터 자료)                            |
| `ai_guide_cache`                           | **보존** (공용 AI 원본 — 지우면 재호출 비용 발생) |
| `system_config` (master_version 등)        | **보존**                                          |

> **AI 데이터 구분**: `ai_guide_cache`(공용 원본)는 보존. `user_checklist_items.custom_guide`(사용자에게 복사된 문구)는 user_checklist_items 삭제와 함께 사라지나, 캐시가 살아있어 새 가입 시 재호출 없이 채워짐(비용 0).

> **`ai_guide_cache` master_version 정합성 (v2)**: 캐시 보존이 비용 절감이 되려면 캐시의 `master_version`이 현재 `system_config.master_checklist_version`과 일치해야 한다. 불일치면 새 가입 시 어차피 재생성(비용 발생)되어 보존 효과가 없다. wipe 전 정합성 확인:
>
> ```sql
> SELECT DISTINCT master_version FROM public.ai_guide_cache;
> SELECT value FROM public.system_config WHERE key = 'master_checklist_version';
> ```
>
> 두 값이 다르면 캐시를 보존해도 의미 없으므로, 그 경우는 캐시를 비우고 prod에서 새로 생성하는 게 깔끔(보존 대상에서 제외 판단).

> **auth.users 삭제 확정 (v2)**: dev 테스트 익명/소셜 계정도 삭제한다. 이유: ① 테스트 계정이 남으면 RLS 검증 중 헷갈림 ② `auth_provider_links`만 지우고 `auth.users`를 유지하면 소셜 재연결 테스트가 꼬임. 삭제 후 iOS Simulator/Android Emulator 앱 데이터 + SecureStore 초기화(`xcrun simctl erase <device-id>`), 필요 시 소셜 provider 콘솔의 테스트 계정 연결도 해제.

### 7-2. 삭제 스크립트 + dev 가드

- dev 전용 삭제 스크립트. **prod 오삭제 방지 가드 필수** (10-1 §0-4의 project-ref 확인 절차 재사용).

```bash
# project-ref가 dev인지 확인 후에만 실행
supabase status   # 현재 link된 project ref 확인
# ref가 dev(ybcqinanfcarhqkclvue)가 아니면 중단
```

```sql
-- dev wipe (master/cache/config 보존)
-- ⭐ preflight 실측: auth.users → public.users → 하위 4개 테이블 전부 ON DELETE CASCADE 확인됨.
--    따라서 auth.users 삭제만으로 앱 데이터 전체가 자동 정리된다.

-- 방법 A (권장, 단순): auth.users 테스트 계정 삭제 → CASCADE로 전부 정리
--   Supabase 콘솔 Authentication에서 테스트 계정 전체 삭제, 또는 admin API:
--   await admin.auth.admin.deleteUser(userId)  // 각 테스트 user
--   → public.users / moves / user_checklist_items / property_photos / auth_provider_links 자동 삭제

-- 방법 B (명시적, 안전 확인용): 직접 DELETE (CASCADE 신뢰 안 할 때)
DELETE FROM public.rate_limit_log;   -- users FK 없음, 별도 삭제
-- 아래는 auth.users CASCADE로 자동 정리되지만, 명시적으로 돌려도 무방 (child→parent 순서):
-- DELETE FROM public.auth_provider_links;
-- DELETE FROM public.property_photos;
-- DELETE FROM public.user_checklist_items;
-- DELETE FROM public.moves;
-- (auth.users 삭제는 콘솔/admin API)

-- 검증: 전부 0건이어야 함
SELECT count(*) FROM public.users;             -- 0
SELECT count(*) FROM public.moves;             -- 0
SELECT count(*) FROM public.property_photos;   -- 0

-- Storage 파일은 FK 밖이라 별도 삭제 (supabase storage rm 또는 storage.objects DELETE)
```

> **preflight 실측 반영**: `public.users.id → auth.users.id`(CASCADE) + 하위 4개 테이블(`auth_provider_links`/`moves`/`property_photos`/`user_checklist_items`) 모두 `user_id → users.id` CASCADE 확인. **auth.users만 지우면 앱 데이터 전체 자동 정리.** `rate_limit_log`는 users FK가 없으므로 별도 삭제. Storage 파일도 FK 밖이라 별도.

> prod에는 삭제할 데이터가 없음(빈 생성) → **prod에서는 삭제 명령을 절대 실행하지 않는다.** prod는 0건 검증만(§7-3).

### 7-3. prod 생성 + 내부 검증

10-1 §0-4 절차 재사용:

```bash
supabase projects list
supabase link --project-ref <PROD_PROJECT_REF>
supabase status   # prod 확인
supabase db push  # 00001~00020 전부
psql "$PROD_DATABASE_URL" -f supabase/seed.sql  # 마스터 체크리스트 46개
supabase functions deploy generate-ai-guide --project-ref <PROD>
supabase functions deploy kakao-token-exchange --project-ref <PROD>
supabase secrets set ANTHROPIC_API_KEY=<key> ANTHROPIC_MODEL=claude-haiku-4-5-20251001 --project-ref <PROD>
# Storage 버킷 property-photos (private) 생성
```

**prod 검증 항목**:

- 마이그레이션 00001~00019 전부 적용
- master_checklist_items 46개 (seed)
- moves / user_checklist_items / property_photos = **0건** (TEMP_USER_ID 0건 검증 = 신규라 자명하나 명시)
- **9개 테이블 RLS ENABLED**: users, moves, master_checklist_items, user_checklist_items, property_photos, ai_guide_cache, system_config, auth_provider_links, rate_limit_log
- `ai_guide_cache.master_version` = `system_config.master_checklist_version` 정합성 (재생성 비용 방지)
- storage.objects 정책: dev permissive 없음 + 본인 경로 select/insert/delete만
- Edge Function 배포 + secrets 설정
- Storage 버킷 private

> ⚠️ `db reset --linked`는 초기 빈 prod 1회만. 데이터 들어간 후 재실행 시 전체 wipe. 운영 시작 후엔 마이그레이션 추가 + `db push`만.

> **환경변수 prod 스위치는 하지 않는다.** production Vercel은 10-2 동안 dev Supabase 연결 유지(ADR-051). prod 스위치는 release-gate(§11).

---

## 8. 마이그레이션 번호 정리

10-1까지 00015 적용 완료. 10-2 신규:

| 번호  | 파일                      | 내용                                                                                                                                                        |
| ----- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00016 | `enable_rls.sql`          | 7개 테이블 ENABLE(system_config 포함) + 충돌 정책 DROP+재CREATE(soft delete 분리, users SELECT only, moves DELETE 없음) + ai_guide_cache/system_config 정책 |
| 00017 | `storage_policy.sql`      | dev permissive DROP + storage.objects 본인 경로 정책 (select/insert/delete, UPDATE 없음)                                                                    |
| 00018 | `rate_limit.sql`          | rate_limit_log 테이블 + window_start 인덱스 + increment_rate_limit RPC + RLS service_role only                                                              |
| 00019 | `migrate_anonymous.sql`   | migrate_anonymous_to_user RPC (keep_target no-op + strategy 예외 + anonymous 검증 + GRANT/REVOKE)                                                           |
| 00020 | `rpc_ownership_guard.sql` | **preflight 발견**: update_move_with_reschedule 소유권 가드 추가 + apply_ai_guides 권한 좁힘(service_role only)                                             |

> 순서 주의: 00016(RLS) 적용 전에 §2 preflight 통과(완료) + §7 dev wipe 선행. 마이그레이션 파일 번호 순서와 실행 시점(wipe)은 별개 — 운영 절차 문서에 명시. 특히 **00017 storage 정책 적용 전 dev wipe(기존 사진 삭제) + 새 경로 적용**이 선행돼야 옛 경로 사진이 새 정책에 갇히지 않는다.

---

## 9. ADR 추가

- **ADR-056**: RLS는 신규 마이그레이션(00016)에서 활성화. 적용된 00003 파일은 수정하지 않되, 00003 정책 중 soft delete와 충돌하는 것(`moves`/`property_photos`의 `FOR ALL ... AND deleted_at IS NULL`)은 00016에서 DROP 후 작업별 분리 재CREATE한다. `deleted_at` 필터는 RLS에서 제거하고 service query가 담당. RLS는 소유권만 강제.
- **ADR-057**: Storage 경로를 `{userId}/{moveId}/{room}_{timestamp}`로 표준화. 실제 6단계 구현은 `{moveId}/...`(인증 도입 시 마이그레이션 회피 목적의 의도된 설계)였고, 인증 도입(=10-2)이 그 단서 조건이므로 표준 RLS 정책(경로 첫 칸 = `auth.uid()`)으로 전환. `photoType`은 경로에서 제거(DB `photo_type` 컬럼이 담당). wipe와 동시 진행해 기존 사진 마이그레이션 회피.
- **ADR-058**: rate limit을 DB 테이블 + 원자적 increment RPC로 구현(vs Redis). 현재 트래픽 규모에서 폭주 차단 목적엔 DB로 충분, Redis는 외부 의존성·운영 복잡도 과다. 인터페이스 분리로 향후 전환 가능. IP는 SHA-256 해시 저장(평문 금지), 보존 24~48h.
- **ADR-059**: ai_guide_cache는 service_role only로 비공개화. 클라이언트는 custom_guide만 읽고 캐시는 Edge Function 내부 디테일로 은닉(관심사 분리 + 캐시 구조 노출 방지). cacheKey 재료는 소유권 검증된 move row에서 서버가 직접 조회(cache poisoning 방지).
- **ADR-060**: 충돌 처리는 폴백 전용 안전망. RPC 정의/contract/테스트만 10-2, 실제 호출·선택 UI는 10-3. `keep_target` no-op만 허용하고 미구현 전략은 예외 처리. conflict=true에서 조용한 병합/삭제/덮어쓰기 금지(데이터 손실 0 보장).
- **ADR-061**: 외부 공개를 RLS 완료 조건에서 분리(release-gate). 코드 완료와 운영 검증(디바이스 격리·실기기 등)을 분리.
- **ADR-062**: public.users는 **SELECT only**(클라이언트 INSERT/UPDATE/DELETE 불허). public.users는 트리거(00013)가 생성하고, `provider`는 migrate RPC의 anonymous 판정에 쓰이는 보안성 컬럼이다. RLS는 컬럼을 못 막으므로 UPDATE 자체를 닫아 provider 위조를 차단한다. 유저 편집 컬럼이 생기면 컬럼 화이트리스트 RPC로(Follow-up).
- **ADR-063**: moves는 클라이언트 DELETE 정책 미생성(soft delete만). hard delete는 10-3 계정삭제에서 service_role/RPC로. 쓰지 않는 권한을 닫아 공격면 축소.
- **ADR-064**: 인증 엔드포인트 rate limit은 fail-closed. 저장소(DB) 장애 시 503으로 차단(열어두지 않음). IP는 `sha256(ip + RATE_LIMIT_SALT)`로 저장(평문·단순해시 역추적 방지). CORS는 `Vary: Origin` + 미허용 origin 403(preflight 포함).
- **ADR-065**: preflight 실측에서 DEFINER RPC 2개의 소유권 검증 누락 발견(`update_move_with_reschedule`, `apply_ai_guides`). 00020에서 전자는 함수 내부 `EXISTS` 소유권 가드 추가(클라이언트 직접 호출 RPC), 후자는 `REVOKE FROM PUBLIC` + `GRANT TO service_role`(Edge Function 전용). DEFINER가 RLS를 우회하므로 RLS 활성화 전 필수 보강. RLS 정책(00016)과 함수 본문/권한은 변경 성격이 달라 별도 마이그레이션으로 분리.

---

## 10. Verify 체크리스트

### 10-0. Preflight (§2) — ✅ 실측 완료

- [x] DEFINER 함수 4개 확인 + `!=` 잔존 0건
- [x] 옛 정책명 drift 0 (DROP 후보 전부 일치)
- [x] users↔auth.users CASCADE 확인 (wipe 단순화)
- [x] storage.foldername [1] = 첫 폴더 확인
- [ ] **00020 적용 후**: `update_move_with_reschedule` 타인 moveId 호출 시 unauthorized 예외 (소유권 가드)
- [ ] **00020 적용 후**: `apply_ai_guides` 클라이언트(authenticated) 직접 호출 차단 (권한 없음)
- [ ] service 함수 userId null guard 전 경로 (훅/페이지/컴포넌트)
- [ ] service 함수 deleted_at 필터 (일반 목록 `.is(null)` / 휴지통 `.not(null)`)

### 10-1. RLS (§3) — 테이블별 분리

- [ ] 9개 테이블 RLS ENABLED (pg_policies 조회): users, moves, master_checklist_items, user_checklist_items, property_photos, ai_guide_cache, system_config, auth_provider_links, rate_limit_log
- [ ] `users`: 본인 SELECT만 / 타인 0건 / **클라이언트 UPDATE·INSERT·DELETE 모두 차단** (v3: provider 위조 방지)
- [ ] `moves`: 본인 SELECT/INSERT/UPDATE / 타인 0건 / **클라이언트 DELETE 차단**(soft delete만) / 정책에 deleted_at 조건 없음 (v3)
- [ ] `master_checklist_items`: anon·authenticated SELECT 공개 / INSERT·UPDATE·DELETE 차단 (v2)
- [ ] `user_checklist_items`: 본인만 / 타인 0건
- [ ] `property_photos`: 본인만 / 타인 0건 / **정책에 deleted_at 조건 없음** (v2)
- [ ] `ai_guide_cache`: 클라이언트 SELECT 차단 (정책 0개)
- [ ] `system_config`: SELECT 공개 / write 차단 (v2)
- [ ] `rate_limit_log`: 클라이언트 SELECT·INSERT 차단, service_role RPC만 증가 (v2)
- [ ] **soft delete 복구 동작** (v2 핵심): PhotoTrashPage에서 휴지통 목록 조회 / 복구(deleted_at=null) / 영구삭제가 모두 정상 (RLS가 deleted 행을 안 가림 확인)
- [ ] **익명 세션 본인 CRUD 정상**
- [ ] **디바이스 B 익명 세션 격리** (서로 다른 auth.uid())

### 10-2. Edge Function (§4)

- [ ] `generate-ai-guide`: JWT 없으면 401 (curl)
- [ ] 익명 JWT로 정상 동작 (비회원 안 막힘)
- [ ] 타인 moveId로 호출 시 403 (소유권 검증)
- [ ] cacheKey가 클라이언트 payload 아닌 서버 조회 move 조건으로 생성됨 (v2)
- [ ] `ai_guide_cache` 클라이언트 직접 SELECT 없음 (grep)
- [ ] `kakao-token-exchange`: 허용 안 된 Origin → **403 reject**(OPTIONS도 403) / 허용 OPTIONS → 204 / POST외 → 405 (v3)
- [ ] CORS 응답에 `Vary: Origin` 포함 (v3)
- [ ] rate limit: anonymous 분당 5회 초과 시 429, IP 시간당 30회 초과 시 429 (increment RPC 원자성)
- [ ] rate limit **DB 장애 시 503**(fail-closed, 429와 구분) (v3)
- [ ] rate_limit_log에 IP가 **salt 해시**로 저장됨 (평문·단순해시 없음) (v3)
- [ ] WebView(Origin null) 경유 호출 정상

### 10-3. Storage (§5)

- [ ] 기존 dev permissive 정책 DROP 확인 (pg_policies storage.objects) (v2)
- [ ] 새 사진 경로 `{userId}/{moveId}/{room}_{timestamp}` 생성 (photoType segment 없음) (v2)
- [ ] 본인 사진 createSignedUrls 발급 정상
- [ ] 타인 경로 createSignedUrl 발급 차단
- [ ] **createSignedUrls 본인/타인 혼합 시 타인 경로 실패/null 처리** (v2)
- [ ] 클라이언트 prefix ownership 가드 동작 (v2)
- [ ] 타인 경로 업로드/삭제 차단
- [ ] upsert=false 유지, UPDATE 정책 없음 (v2)
- [ ] 버킷 private 유지

### 10-4. 충돌 RPC (§6)

- [ ] `migrate_anonymous_to_user` auth.uid() 없으면 예외
- [ ] source == target 예외
- [ ] source가 anonymous 아니면 예외 (v2)
- [ ] keep_target no-op 확인
- [ ] `replace_with_source`/`keep_both` → not implemented 예외 (v2)
- [ ] migrate RPC 함수 권한: PUBLIC EXECUTE 없음, authenticated만 (v3)
- [ ] linkIdentity 후 public.users.provider 갱신 실측 (v2, anonymous 판정 전제)
- [ ] 폴백 발동 로깅 동작
- [ ] 폴백 시 안내 배너 표시 + 기존 계정 사용 가능

### 10-5. wipe + prod (§7)

- [ ] dev: 사용자 데이터 0건, master 46개 보존, ai_guide_cache 보존
- [ ] dev: auth.users 테스트 계정 삭제 + public.users 잔여 0건 (v2)
- [ ] dev: ai_guide_cache.master_version = system_config.master_checklist_version 정합성 (v2)
- [ ] dev wipe 스크립트 project-ref 가드 동작
- [ ] prod: 마이그레이션 00001~00019 적용
- [ ] prod: master 46개 seed, 사용자 데이터 0건
- [ ] prod: 9개 테이블 RLS ENABLED, Edge Function 배포, 버킷 private
- [ ] prod 환경변수 스위치 안 함 (dev 연결 유지 확인)

### 10-6. 수동 RLS smoke 스크립트 (§11 연계, v2)

- [ ] `scripts/verify/rls-smoke.ts` 작성 (CI 미연결, 수동 실행)
- [ ] user A/B 익명 세션 → A move 생성 → B가 A move select/update/delete 시도 실패/0건
- [ ] A photo 경로 → B signed URL 발급 시도 실패

### 10-7. 빌드/린트/테스트

- [ ] `pnpm build` 에러 없음
- [ ] `pnpm lint` 에러 없음
- [ ] `pnpm test` 통과 (충돌 RPC 테스트 포함)

---

## 11. Follow-up (다음으로 미룬 것)

- **수동 RLS smoke 스크립트** (v2, 10-2 포함) — `scripts/verify/rls-smoke.ts`. user A/B 격리를 실제 쿼리로 확인. **CI 미연결, 수동 실행.** RLS는 치명적 보안 경계라 최소 수동 검증 도구는 10-2에 둔다.
- **RLS 통합 테스트 자동화 (CI 연결)** ⭐ — 위 smoke를 픽스처·테스트 유저·CI에 정식 편입. 별도 단계(10-2.5 또는 10-3 병합). "수동 검증으로 출시 게이트 통과 + 회귀 보장은 자동 테스트로 분리"가 의도.
- **충돌 처리 정식 선택 UI** (유지/교체/둘 다 보관) — 10-3. 폴백 발동률 로깅 데이터 보고 우선순위 결정. 실제 데이터 이전 시 **migration_token 또는 `auth_provider_conflicts` 테이블**로 source↔target 관계 증명(§6-5).
- **prod 외부 공개 (release-gate)** — 환경변수 prod 스위치 + URL 공유. 선행 조건: RLS 전수 검증 + Kakao rate limit + 10-1 미검증 항목(디바이스 A/B, 토큰 만료 재가입, Apple 실기기, curl 405) 실기기 검증 완료.
- proactive token refresh, 익명 user cleanup, Captcha — 운영 준비 단계.

---

## 12. 면접 대비 핵심 포인트

### "RLS가 인증인가요?"

> 아니요, 인가입니다. 인증(10-1)은 "누구인가"를 JWT로 확정하는 것이고, RLS(10-2)는 그 신원(`auth.uid()`)을 재료로 "어떤 행에 접근 가능한가"를 DB가 강제하는 인가입니다. 둘은 연결돼 있습니다 — 인증이 신원을 만들고, RLS가 그걸로 권한을 판단합니다.

### "왜 service 함수 필터가 있는데 RLS도 켜나요?"

> 코드 레벨 필터는 "내가 안 빠뜨리면" 안전한 신뢰 기반입니다. 한 곳이라도 누락하거나 anon key로 직접 쿼리하면 데이터가 샙니다. RLS는 DB 엔진이 강제하는 최종 방어선이라, 코드가 실수해도 막아줍니다. 필터는 1차, RLS는 2차 방어로 두는 다층 방어입니다.

### "Storage 경로를 왜 바꿨나요?"

> 6단계에서 의도적으로 moveId 기반 경로를 써서 인증 도입 시 마이그레이션을 피하려 했습니다. 인증을 도입한 지금이 그 단서의 조건이고, 표준 Storage 정책(경로 첫 칸 = auth.uid())을 걸려면 경로에 user_id가 필요합니다. 마침 기존 사진이 전부 테스트 데이터라 wipe와 동시에 진행해 실제 마이그레이션 비용 없이 전환했습니다.

### "rate limit을 왜 Redis가 아니라 DB로?"

> 현재 트래픽 규모에서 목적은 비용 폭탄 방어(폭주 차단)지 정밀 통제가 아닙니다. Redis는 외부 의존성과 운영 복잡도를 더하는데 그만한 규모가 아닙니다. DB 테이블로 충분하고, 규모가 커지면 인터페이스를 분리해 전환할 수 있게 뒀습니다.

### "비용 폭탄 공격을 어떻게 막았나요?"

> Edge Function URL은 클라이언트 코드에 노출돼 사실상 공개입니다. JWT 없는 외부 호출을 401로 막아 AI 호출(비용) 이전에 차단하고, 토큰을 받아낸 경우도 rate limit으로 폭주를 막는 다층 방어입니다. 익명 sign-in 도입으로 비회원도 JWT를 갖기 때문에 JWT 필수가 비회원 우선 전략과 충돌하지 않습니다.

### "충돌 처리는 왜 RPC만 만들고 UI는 미뤘나요?"

> spike에서 메인 경로(linkIdentity)가 user.id를 유지해 데이터가 그대로 따라오는 걸 확인했습니다. 충돌 처리는 폴백 경로가 발동한 소수 케이스에서만 의미가 있는데, 그 발동률이 아직 측정되지 않았습니다. 안전망(RPC)과 데이터 손실 0 보장(조용한 병합 금지)만 먼저 두고, 선택 UI는 발동률 로깅을 본 뒤 만드는 게 단순함·확장성 우선 원칙에 맞습니다.

### "soft delete를 쓰는데 RLS는 어떻게 설계했나요?"

> 처음엔 RLS 정책에 `deleted_at IS NULL`을 넣었는데, 그러면 삭제된 행이 RLS에 가려져 휴지통 복구·영구삭제가 깨지는 문제가 있었습니다. 그래서 RLS는 소유권(`auth.uid() = user_id`)만 강제하고, active/deleted 구분은 service query에서 처리하도록 분리했습니다. 인가(누구 것인가)와 조회 조건(어떤 상태인가)을 섞지 않는 게 핵심이었습니다.

```

```
