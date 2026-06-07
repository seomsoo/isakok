-- 00025_users_push_columns.sql
-- 푸시 설정 컬럼 (12단계 §3-3, ADR-096).
-- push_enabled: 앱 토글. 권한 granted + 토큰 등록 성공 시에만 true (기본 false라 effective status 정확).
-- push_prompt_seen_at: soft-ask 1회 노출 가드 (persistent — reload/재시작에도 재노출 0).
-- 둘 다 users UPDATE 차단(10-2)이라 set_push_enabled/set_push_prompt_seen RPC(00026)로만 변경.
-- 익명도 auth.users→public.users 트리거(00013)로 행 존재 → 그대로 적용.

ALTER TABLE public.users
  ADD COLUMN push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN push_prompt_seen_at timestamptz;
