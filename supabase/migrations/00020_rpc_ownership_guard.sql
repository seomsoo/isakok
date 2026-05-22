-- 00020_rpc_ownership_guard.sql
-- (1) 옛 8인자 update_move_with_reschedule DROP (RLS 우회 방지)
-- (2) 9인자 버전 재생성 (auth.uid() 소유권 가드)
-- (3) apply_ai_guides 권한 service_role only

-- ============ DROP 옛 8인자 overload (SECURITY DEFINER, 소유권 검증 없음) ============
DROP FUNCTION IF EXISTS public.update_move_with_reschedule(uuid, date, text, text, text, boolean, text, text);

-- ============ 9인자 버전: auth.uid() 소유권 가드 ============
CREATE OR REPLACE FUNCTION public.update_move_with_reschedule(
  p_move_id uuid,
  p_user_id uuid,
  p_moving_date date,
  p_housing_type text,
  p_contract_type text,
  p_move_type text,
  p_is_first_move boolean DEFAULT false,
  p_from_address text DEFAULT NULL,
  p_to_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized: user_id mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.moves
    WHERE id = p_move_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'unauthorized: move not found or not owned';
  END IF;

  UPDATE public.moves
  SET
    moving_date = p_moving_date,
    housing_type = p_housing_type,
    contract_type = p_contract_type,
    move_type = p_move_type,
    is_first_move = p_is_first_move,
    from_address = p_from_address,
    to_address = p_to_address
  WHERE id = p_move_id;

  UPDATE public.user_checklist_items uci
  SET assigned_date = p_moving_date + m.d_day_offset
  FROM public.master_checklist_items m
  WHERE uci.move_id = p_move_id
    AND uci.master_item_id = m.id
    AND uci.is_completed = false;

  INSERT INTO public.user_checklist_items (move_id, user_id, master_item_id, assigned_date)
  SELECT
    p_move_id,
    p_user_id,
    m.id,
    p_moving_date + m.d_day_offset
  FROM public.master_checklist_items m
  WHERE
    p_housing_type = ANY(m.housing_types)
    AND p_contract_type = ANY(m.contract_types)
    AND p_move_type = ANY(m.move_types)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_checklist_items uci
      WHERE uci.move_id = p_move_id AND uci.master_item_id = m.id
    );

  DELETE FROM public.user_checklist_items uci
  USING public.master_checklist_items m
  WHERE uci.move_id = p_move_id
    AND uci.master_item_id = m.id
    AND uci.is_completed = false
    AND (
      NOT (p_housing_type = ANY(m.housing_types))
      OR NOT (p_contract_type = ANY(m.contract_types))
      OR NOT (p_move_type = ANY(m.move_types))
    );
END;
$$;

-- ============ apply_ai_guides: service_role only ============
REVOKE ALL ON FUNCTION public.apply_ai_guides(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_ai_guides(uuid, jsonb) TO service_role;
