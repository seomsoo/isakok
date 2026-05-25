# 10-2 RLS 보안 — Verify 리포트

> 검증 일시: 2026-05-22 (코드 검증) / 2026-05-25 (런타임 실측 완료)
> 스펙: `docs/specs/10-2-rls-security.md` (v3, 979줄)
> 브랜치: `feat/10-2-rls-security` → PR #47 머지 완료

---

## 완료 확인 기준 결과

### 10-0. Preflight (§2)

- [x] DEFINER 함수 4개 확인 + `!=` 잔존 0건
- [x] 옛 정책명 drift 0 (DROP 후보 전부 일치)
- [x] users↔auth.users CASCADE 확인 (wipe 단순화)
- [x] storage.foldername [1] = 첫 폴더 확인
- [x] **00020 적용 후**: `update_move_with_reschedule` 타인 moveId 호출 시 unauthorized 예외 — ~~⚠️ 소유권 가드는 00016에 구현되어 있으나, **00002의 옛 8인자 overload가 DROP되지 않아 우회 가능** (🔴 P1)~~ → ✅ 00020_rpc_ownership_guard.sql로 분리 + `DROP FUNCTION IF EXISTS` 추가 완료
- [x] **apply_ai_guides** 클라이언트(authenticated) 직접 호출 차단 — 00016에서 REVOKE/GRANT 적용
- [x] service 함수 deleted_at 필터: photos.ts(`.is('deleted_at', null)` / `.not('deleted_at', 'is', null)`), move.ts(`.is('deleted_at', null)`) 모두 적절
- [x] ai_guide_cache 클라이언트 직접 SELECT 없음 (grep 0건)
- [x] image_url 잔존 없음 (grep 0건)

### 10-1. RLS (§3)

- [x] 9개 테이블 RLS ENABLED (파일 기준): 00016(7개) + 00014(auth_provider_links) + 00018(rate_limit_log)
- [x] `users`: SELECT only 정책 (UPDATE/INSERT/DELETE 불허, provider 위조 차단)
- [x] `moves`: SELECT/INSERT/UPDATE, DELETE 없음(soft delete만)
- [x] `master_checklist_items`: 00003의 master_select_public 유지 (USING true)
- [x] `user_checklist_items`: 00003의 user_checklist_all_own 유지
- [x] `property_photos`: SELECT/INSERT/UPDATE/DELETE, deleted_at 조건 없음
- [x] `ai_guide_cache`: 정책 3개 후보 DROP → service_role only
- [x] `system_config`: SELECT public, write 불가
- [x] `rate_limit_log`: 00018에서 ENABLE, 정책 0개 = service_role only
- [x] soft delete 복구 동작 — rls-smoke.ts A가 soft delete 후 정상 동작 확인 (2026-05-25)
- [x] 익명 세션 본인 CRUD 정상 — 브라우저 테스트로 온보딩(move+checklist 생성) + 사진 업로드 성공 (2026-05-25)
- [x] 디바이스 B 익명 세션 격리 — rls-smoke.ts 16/16 통과 (2026-05-25)

### 10-2. Edge Function (§4)

- [x] `generate-ai-guide`: JWT 없으면 401 (`extractUserId` + `if (!jwtUserId)` 가드)
- [x] 익명 JWT로 정상 동작 (`auth.getUser()`가 anonymous도 반환)
- [x] 타인 moveId로 호출 시 403 (`move.user_id !== jwtUserId`)
- [x] cacheKey가 서버 조회 move 조건으로 생성 (cache poisoning 방지)
- [x] `ai_guide_cache` 클라이언트 직접 SELECT 없음
- [x] `kakao-token-exchange`: 미허용 Origin → 403 reject (OPTIONS도 403)
- [x] 허용 OPTIONS → 204 / POST 외 → 405
- [x] CORS 응답에 `Vary: Origin` 포함 (makeCorsHeaders)
- [x] rate limit: user 분당 5회 + IP 시간당 30회 (increment RPC 원자성)
- [x] rate limit DB 장애 시 503 (fail-closed, 429와 구분)
- [x] rate_limit_log에 IP가 salt 해시로 저장 (`sha256(ip:salt)`)
- [x] WebView(Origin null) 경유 호출 허용 (`resolved === null` 분기)
- [x] Edge Function JWT/rate limit 실동작 — curl 4건 통과: generate-ai-guide JWT없음→401, 잘못된origin→403 / kakao-token-exchange 잘못된origin→403, JWT없음→401 (2026-05-25)

### 10-3. Storage (§5)

- [x] 기존 dev permissive 정책 DROP (00017: 4개 후보 DROP)
- [x] 새 사진 경로 `{userId}/{moveId}/{room}_{timestamp}` (photoType segment 없음)
- [x] 클라이언트 prefix ownership 가드 (`path.startsWith(`${userId}/`)`)
- [x] upsert=false 유지 (photos.ts:111)
- [x] UPDATE 정책 없음 (00017에 미생성)
- [x] 본인 사진 createSignedUrls 발급 정상 — 브라우저에서 사진 업로드 후 썸네일 정상 렌더링 (2026-05-25)
- [x] 타인 경로 createSignedUrl 발급 차단 — rls-smoke.ts Storage 격리 테스트 통과 (2026-05-25)
- [x] createSignedUrls 본인/타인 혼합 시 타인 경로 에러 반환 — 실측 통과 (2026-05-25)
- [x] 타인 경로 업로드/삭제 차단 — B→A경로 upload 거부 + delete 0건 반환 확인 (2026-05-25)
- [x] 버킷 private 유지 — getPublicUrl로 fetch 시 비정상 응답 확인 (2026-05-25)

### 10-4. 충돌 RPC (§6)

- [x] `migrate_anonymous_to_user` auth.uid() 없으면 예외
- [x] source == target 예외
- [x] source가 anonymous 아니면 예외
- [x] keep_target no-op 확인 (RETURN jsonb `{migrated: false}`)
- [x] `replace_with_source`/`keep_both` → not implemented 예외
- [x] migrate RPC 함수 권한: REVOKE FROM PUBLIC + GRANT TO authenticated
- [x] linkIdentity 후 public.users.provider 갱신 실측 — ✅ Apple/Google/Kakao 로그인 후 DB trigger handle_user_provider_update 동작 확인 (2026-05-25)
- [x] 폴백 시 안내 배너 표시: auth.tsx "이전에 작성한 내용을 옮기는 기능은 곧 제공돼요"
- [ ] 폴백 발동 로깅 — ⚠️ console.warn만 존재, 영속 로깅(DB 카운트 등) 미구현 (🟡)

### 10-5. wipe + prod (§7)

- [x] dev-wipe.sql 존재 (child→parent 순서, master/cache/config 보존, Storage 삭제 포함)
- [x] dev wipe project-ref 가드: 주석으로 수동 확인 지시 (스펙과 일치)
- [x] dev: 사용자 데이터 0건 확인 — dev-wipe.sql 실행, 6개 테이블 전부 0건 + 보존 대상 정상 (master 46, cache 4, config 1). Storage는 SQL 삭제 불가(protect_delete 트리거), 대시보드에서 수동 정리 (2026-05-25)
- [x] dev: ai_guide_cache.master_version 정합성 — ~~⚠️ dev-wipe.sql에 확인 쿼리 누락 (🟡)~~ → ✅ 정합성 비교 쿼리 추가
- [ ] prod: 마이그레이션 적용 — 미진행
- [ ] prod: master 46개 seed — 미진행
- [ ] prod: 9개 테이블 RLS ENABLED 확인 — 미진행
- [ ] prod 환경변수 스위치 안 함 — 확인 필요

### 10-6. 수동 RLS smoke 스크립트

- [x] `scripts/verify/rls-smoke.ts` 작성
- [x] user A/B 익명 세션 → A move 생성 → B가 A move select/update 시도 실패/0건
- [x] users SELECT 격리 + UPDATE 차단 검증
- [x] master_checklist_items / system_config public read 검증
- [x] ai_guide_cache 클라이언트 접근 차단 검증 — ~~⚠️ 빈 테이블 false positive (🟡 Codex P2)~~ → ✅ service_role로 시드 행 삽입 후 검증하도록 수정
- [x] A photo 경로 → B signed URL 발급 시도 실패 — ~~⚠️ Storage 격리 테스트 미포함 (🟡)~~ → ✅ Storage signed URL 격리 테스트 추가

### 10-7. 빌드/린트/테스트

- [x] `pnpm build` 에러 없음
- [x] `pnpm lint` 에러 없음
- [x] `pnpm test` 통과 (16 passed, 3 files)

---

## 누락 (스펙에 있는데 구현 안 됨)

1. ~~**🔴 00020_rpc_ownership_guard.sql 미분리 + 옛 overload DROP 누락**~~ → ✅ 수정 완료: 00020_rpc_ownership_guard.sql 생성, `DROP FUNCTION IF EXISTS` + 9인자 재생성 + REVOKE/GRANT 분리
2. ~~**🟡 ADR-065 docs/DECISIONS.md에 누락**~~ → ✅ 수정 완료: ADR-065 추가
3. **🟡 폴백 발동 영속 로깅 미구현**: 스펙 §6-3은 "Edge Function 로그 또는 가벼운 카운트 테이블" 요구, 구현은 console.warn만 — ⏳ 후속 작업 (DB 스키마 결정 필요)
4. ~~**🟡 rls-smoke.ts Storage 격리 테스트 없음**~~ → ✅ 수정 완료: Storage signed URL 격리 테스트 추가
5. ~~**🟡 dev-wipe.sql에 master_version 정합성 확인 쿼리 누락**~~ → ✅ 수정 완료: 정합성 비교 쿼리 추가

---

## 스코프 크립 (구현했는데 스펙에 없음)

- 없음

---

## 컨벤션 위반

- 없음 (Conventional Commits, 파일 컨벤션, CLAUDE.md 규칙 준수)

---

## Codex 코드리뷰 결과

- **[P1] supabase/migrations/00016_enable_rls.sql:54** — 옛 RPC overload DROP 누락
  - 문제: 00002에서 `update_move_with_reschedule(uuid, date, text, text, text, boolean, text, text)` 8인자로 생성. 00015/00016에서 `p_user_id`를 추가한 9인자로 `CREATE OR REPLACE`했지만 PostgreSQL은 다른 시그니처를 별개 함수로 취급. 옛 8인자 함수(SECURITY DEFINER, 소유권 검증 주석 처리)가 여전히 호출 가능 → **남의 moveId만 알면 RLS 우회하여 데이터 수정 가능**
  - 수정: ✅ 수정 완료 — RPC 섹션을 00020_rpc_ownership_guard.sql로 분리, `DROP FUNCTION IF EXISTS public.update_move_with_reschedule(uuid, date, text, text, text, boolean, text, text);` 추가

- **[P2] scripts/verify/rls-smoke.ts:111-115** — ai_guide_cache 빈 테이블 false positive
  - 문제: `assert('A cannot read ai_guide_cache', (aCache?.length ?? 0) === 0 || !!aCacheErr)` — 빈 테이블에서 성공적 SELECT도 `length === 0`이므로 RLS 차단과 구분 불가. dev/prod에서 캐시가 0건이면 정책이 실제로 동작하는지 알 수 없음
  - 수정: ✅ 수정 완료 — SUPABASE_SERVICE_ROLE_KEY가 있으면 시드 행 삽입 후 authenticated 읽기 시도, 없으면 경고 출력

---

## spec-reviewer 결과

> 복잡 단계 (DB + Edge Function + Storage + 클라이언트, 979줄) — spec-reviewer 호출

### 🔴 필수 수정 (3건) → 모두 수정 완료

1. ~~**00002 옛 overload DROP 누락 + 00020 미분리**~~ → ✅ 00020_rpc_ownership_guard.sql 생성 + DROP 추가
2. ~~**generate-ai-guide CORS `Access-Control-Allow-Origin: *`**~~ → ✅ `resolveCorsOrigin`/`makeCorsHeaders` 패턴으로 통일, 레거시 `corsHeaders` export 제거
3. ~~**스펙 §7-3 vs §8 마이그레이션 범위 불일치**~~ → ✅ 00020 파일 생성으로 해결

### 🟡 권장 수정 (4건) → 3건 수정, 1건 잔존

1. ~~rls-smoke.ts에 Storage 격리 테스트 없음~~ → ✅ 추가
2. ~~dev-wipe.sql에 ai_guide_cache master_version 정합성 확인 쿼리 누락~~ → ✅ 추가
3. ~~cors.ts 레거시 `corsHeaders` 객체 잔존~~ → ✅ 제거
4. `userId ?? ''` 빈 문자열 가드 패턴 — enabled 조건 변경 시 빈 문자열 userId로 쿼리 실행 위험 (기존 코드, 저위험)

### 🟢 양호 (10건)

- 00016 RLS 정책 내용: 스펙 §3과 완전 일치 (soft delete 분리, users SELECT only, moves DELETE 없음, property_photos DELETE 유지)
- 00017 Storage 정책: 스펙 §5-2 완전 일치
- 00018 rate_limit: 스펙 §4-3 완전 일치
- 00019 migrate_anonymous: 스펙 §6-2 완전 일치
- generate-ai-guide JWT + move 소유권: 스펙 §4-1 일치
- kakao-token-exchange CORS + rate limit: 스펙 §4-3 완전 일치
- photos.ts Storage 경로 변경: 스펙 §5-1 일치
- signed URL ownership guard: 스펙 §5-2 일치
- dev-wipe.sql: child→parent 순서, 보존 대상 정확
- rls-smoke.ts: A/B 격리, users UPDATE 차단, public table read 적절

---

## 서브에이전트 리뷰 결과

### web-a11y-reviewer

🔴 5건 / 🟡 12건 — **10-2 변경으로 인한 접근성 회귀 0건** (모두 기존 이슈)

- 🔴 포커스 트랩 누락: PhotoDetailSheet, RestoreConfirmDialog, DeletePhotoDialog (3건)
- 🔴 포커스 자동 이동 누락: PhotoDetailSheet, MoveEditSheet (2건)
- 🟡 Skeleton 로딩 상태 스크린리더 안내 없음 (DashboardPage, TimelinePage)
- 🟡 PreCheckItem `role="checkbox"` + `aria-checked` 누락
- 🟡 `<main>` 랜드마크 누락 (Dashboard/Timeline/ChecklistDetail/PreCheck 4개 페이지)
- 🟡 MoveEditSheet `role="dialog"` 누락
- 🟡 기타 7건 (드롭다운 Esc, FilterChip aria-pressed, Button 로딩 라벨 등)
- 신규 추가 LoginEntryButton (OnboardingPage): 접근성 적절 ✅

### native-a11y-reviewer

P2 5건 / P3 4건 — auth.tsx 신규 로그인 화면 중심

- P2: 로그인 버튼에 `accessibilityHint` 누락 (Apple/Google/Kakao)
- P2: Skip 버튼에 `accessibilityHint` 누락
- P2: 로딩 ActivityIndicator 스크린리더 미공지 (`announceForAccessibility` 없음)
- P2: 모달 열릴 때 포커스 이동 미확인
- P2: 에러 출현 후 포커스 관리 없음
- P3: subtitle 그룹핑, 버튼 minWidth, WebView 로딩 완료 공지, 에러/오프라인 복구 포커스
- 터치 타겟: 모든 버튼 48px minHeight ✅ (iOS 44pt / Android 48dp 충족)

### ux-state-reviewer

4상태 완전 2/10 — **Error 분기 누락이 가장 심각**

- ✅ 완전: ChecklistDetailPage, EntryRedirect (2개)
- ❌ Error 누락: DashboardPage, TimelinePage, PhotosPage, PhotoRoomPage, PhotoTrashPage, PhotoReportPage, SettingsPage, DeletedPhotosSection (8개) — 에러가 빈 상태/랜딩 리다이렉트로 위장됨
- ❌ Loading 빈 화면: PhotoRoomPage, PhotoTrashPage — `<main className="min-h-dvh bg-neutral" />` (스피너 없음)
- ❌ useCreateMove onError에 사용자 토스트 없음 (console.error만)
- ⚠️ 웹 환경 401 에러 무시: `handleAuthError`가 `isNativeWebView()` 체크로 웹에서 사용자 피드백 없음 — RLS 활성화 후 세션 만료 시 모든 쿼리 조용히 실패 가능

### security-auditor

🔴 2건 / 🟡 5건 / 🟢 안전 다수

- ~~🔴 CRITICAL-1: `update_move_with_reschedule` 옛 8인자 오버로드 미제거~~ → ✅ 00020에서 DROP 추가
- ~~🔴 CRITICAL-2: `generate-ai-guide` CORS `Access-Control-Allow-Origin: *`~~ → ✅ origin 제한 패턴 적용 + 레거시 export 제거
- 🟡 WARNING-1: Storage UPDATE 정책 없음 — 현재 앱이 사용 안 하므로 의도적 (스펙 §5-2 확인). 향후 필요 시 추가
- 🟡 WARNING-2: `RATE_LIMIT_SALT` 미설정 시 빈 문자열 폴백 → IP 해시 역추적 가능. fail-hard 또는 경고 로그 권장
- 🟡 WARNING-3: dev-wipe.sql 프로그래매틱 prod 가드 없음 — 주석 지시만으로 인적 오류 방어 부족
- 🟡 WARNING-4: rls-smoke.ts 빈 테이블 false positive — master_checklist_items/system_config 시드 없이 실행 시 실패 (전제조건 체크 없음)
- 🟡 WARNING-5: `migrate_anonymous_to_user` 에러 메시지가 사용자 존재 여부 누출 — "source user is not anonymous" → 존재 여부 + provider 유형 추론 가능. UUID 추측 어려워 저위험
- 🟢 안전: RLS 정책 전체(9개 테이블), rate limit fail-closed, JWT 검증 흐름, service_role 격리, 입력 검증(parameterized query), NULL-safe 비교(`IS DISTINCT FROM`)

### perf-budget-reviewer

🟢 10-2 변경으로 인한 번들 증가 없음

- 모바일 신규 의존성 6개: 네이티브 모듈 위주, JS 번들 영향 미미
- 웹 `apps/web/package.json` 변경 없음, auth 코드 ~100줄 경량
- 837KB 단일 청크 경고는 기존 구조적 문제 (코드 스플리팅 미적용)
- 개선 기회: exifreader/react-day-picker lazy import, 라우트 기반 코드 스플리팅, manualChunks — Follow-up

---

## 종합 판정

### ✅ 통과 (수정 반영 후)

**P0 — 보안** ✅ 수정 완료

1. ~~**옛 RPC overload DROP**~~ → 00020_rpc_ownership_guard.sql에 `DROP FUNCTION IF EXISTS` 추가

**P1 — 스펙 구조** ✅ 수정 완료

2. ~~**00020 마이그레이션 분리**~~ → 00020_rpc_ownership_guard.sql 생성
3. ~~**generate-ai-guide CORS origin 제한**~~ → `resolveCorsOrigin`/`makeCorsHeaders` 패턴 통일, 레거시 `corsHeaders` export 제거
4. ~~**ADR-065 DECISIONS.md에 추가**~~ → ADR-065 추가 완료

**P2 — 검증 품질** 6/7건 수정, 1건 후속

5. ~~**rls-smoke.ts ai_guide_cache false positive 수정**~~ → service_role 시드 행 + 경고 출력
6. ~~**rls-smoke.ts Storage 격리 테스트 추가**~~ → B가 A 경로 signed URL 발급 실패 검증
7. ~~**dev-wipe.sql master_version 정합성 확인 쿼리 추가**~~ → CROSS JOIN 비교 쿼리 추가
8. **폴백 발동 영속 로깅**: console.warn → DB 카운트 또는 Edge Function 로그 영속화 — ⏳ 후속 작업 (DB 스키마 결정 필요)

**Follow-up (10-2 완료 조건 아님)**

- ux-state-reviewer Error 분기 누락 8개 페이지 (기존 이슈, 별도 단계)
- web-a11y-reviewer 포커스 트랩/`<main>` 랜드마크 (기존 이슈)
- native-a11y-reviewer accessibilityHint 추가 (개선)
- 웹 번들 코드 스플리팅 (perf-budget)
- ~~DB 적용 후 실측 항목 (soft delete 복구, 익명 CRUD, 디바이스 격리, Edge Function curl 등)~~ → ✅ 전체 실측 완료 (2026-05-25)
