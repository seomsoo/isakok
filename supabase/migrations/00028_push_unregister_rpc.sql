-- 00028_push_unregister_rpc.sql
-- 로그아웃 시 이 계정의 푸시 토큰/토글을 끊는 RPC (12단계 보강, ADR-093/096).
-- 문제: signOut은 user를 삭제하지 않고 새 익명 세션으로 전환만 한다. ExpoPushToken은 재설치 전까지
--   동일하므로 push_tokens row가 옛 user에 매핑된 채 남고 users.push_enabled=true도 유지된다 →
--   다음 발송 Cron이 옛 user를 대상에 넣어, 같은 기기를 쓰는 새 익명 유저에게 옛 user 알림을 보낸다.
-- 해결: 로그아웃 직전(옛 user JWT 유효 시) 본인 토큰 전체 삭제 + set_push_enabled(false)로 발송 대상에서 제외.
--   push_tokens는 service_role only(정책 0개)라 클라이언트가 직접 못 지우므로, 본인 행만 지우는
--   DEFINER 함수로 내린다(set_push_enabled와 동일 패턴: DEFINER + auth.uid() + search_path).
-- 계정 삭제(delete-account)는 user 삭제 CASCADE로 토큰이 정리되므로 이 함수가 불필요 — 로그아웃 전용.

CREATE OR REPLACE FUNCTION public.delete_my_push_tokens()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.push_tokens WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.delete_my_push_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_push_tokens() TO authenticated;
