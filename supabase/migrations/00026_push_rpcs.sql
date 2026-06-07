-- 00026_push_rpcs.sql
-- users 컬럼 화이트리스트 RPC (12단계 §3-4, ADR-096).
-- public.users는 10-2에서 UPDATE 전면 차단(provider/email 위조 방지). push 컬럼도 직접 update 불가라
-- update_move_with_reschedule와 동일한 DEFINER + auth.uid() 본인검증 + search_path 패턴으로만 변경.
-- 익명도 authenticated 롤이라 GRANT TO authenticated로 함께 커버.

CREATE OR REPLACE FUNCTION public.set_push_enabled(p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET push_enabled = p_enabled, updated_at = now() WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_push_enabled(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_push_enabled(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_push_prompt_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET push_prompt_seen_at = now(), updated_at = now()
  WHERE id = auth.uid() AND push_prompt_seen_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.set_push_prompt_seen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_push_prompt_seen() TO authenticated;
