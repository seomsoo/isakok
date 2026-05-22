-- 00019_migrate_anonymous.sql
-- 폴백 경로: 익명 user 데이터를 새 user로 이전하는 RPC
-- 10-2는 keep_target(no-op)만 허용. 실제 이전은 10-3.

CREATE OR REPLACE FUNCTION public.migrate_anonymous_to_user(
  p_anonymous_user_id uuid,
  p_strategy text DEFAULT 'keep_target'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_user_id uuid := auth.uid();
BEGIN
  IF v_new_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: no auth context';
  END IF;
  IF p_anonymous_user_id = v_new_user_id THEN
    RAISE EXCEPTION 'invalid: source and target are identical';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_anonymous_user_id AND provider = 'anonymous'
  ) THEN
    RAISE EXCEPTION 'invalid: source user is not anonymous';
  END IF;

  IF p_strategy IS DISTINCT FROM 'keep_target' THEN
    RAISE EXCEPTION 'strategy % is not implemented in 10-2 (see 10-3)', p_strategy;
  END IF;

  RETURN jsonb_build_object('migrated', false, 'strategy', 'keep_target');
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_anonymous_to_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrate_anonymous_to_user(uuid, text) TO authenticated;
