-- 00002_create_rpc.sql
-- RPC 함수 2개: create_move_with_checklist, update_move_with_reschedule

-- ============================================================
-- 1. create_move_with_checklist
-- 이사 생성 + 마스터 체크리스트 필터링 + user_checklist_items 복사 (원자적 트랜잭션)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_move_with_checklist(
  p_user_id uuid,
  p_moving_date date,
  p_housing_type text,
  p_contract_type text,
  p_move_type text,
  p_is_first_move boolean DEFAULT false,
  p_from_address text DEFAULT NULL,
  p_to_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_move_id uuid;
BEGIN
  -- 권한 체크: 본인만 자기 이사를 생성할 수 있음
  -- 8단계에서 인증 추가 시 아래 주석 해제
  -- IF p_user_id IS DISTINCT FROM auth.uid() THEN
  --   RAISE EXCEPTION 'unauthorized: user_id mismatch';
  -- END IF;

  -- 1. 이사 생성
  INSERT INTO public.moves (user_id, moving_date, housing_type, contract_type, move_type, is_first_move, from_address, to_address)
  VALUES (p_user_id, p_moving_date, p_housing_type, p_contract_type, p_move_type, p_is_first_move, p_from_address, p_to_address)
  RETURNING id INTO v_move_id;

  -- 2. 마스터 체크리스트에서 조건 필터링 → user_checklist_items로 복사
  INSERT INTO public.user_checklist_items (move_id, user_id, master_item_id, assigned_date)
  SELECT
    v_move_id,
    p_user_id,
    m.id,
    p_moving_date + m.d_day_offset
  FROM public.master_checklist_items m
  WHERE
    p_housing_type = ANY(m.housing_types)
    AND p_contract_type = ANY(m.contract_types)
    AND p_move_type = ANY(m.move_types);

  RETURN v_move_id;
END;
$$;

-- ============================================================
-- 2. update_move_with_reschedule
-- 이사 정보 수정 + 미완료 체크리스트 날짜 재계산 (원자적 트랜잭션)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_move_with_reschedule(
  p_move_id uuid,
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
  -- 권한 체크: 본인 이사만 수정 가능
  -- 8단계에서 인증 추가 시 아래 주석 해제
  -- IF NOT EXISTS (
  --   SELECT 1 FROM public.moves
  --   WHERE id = p_move_id AND user_id = auth.uid()
  -- ) THEN
  --   RAISE EXCEPTION 'unauthorized: move not found or not owned';
  -- END IF;

  -- 1. 이사 정보 업데이트
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

  -- 2. 미완료 항목만 날짜 재계산 (완료된 항목은 건드리지 않음)
  UPDATE public.user_checklist_items uci
  SET assigned_date = p_moving_date + m.d_day_offset
  FROM public.master_checklist_items m
  WHERE uci.move_id = p_move_id
    AND uci.master_item_id = m.id
    AND uci.is_completed = false;

  -- 3. 조건 변경으로 새로 해당되는 항목 추가
  INSERT INTO public.user_checklist_items (move_id, user_id, master_item_id, assigned_date)
  SELECT
    p_move_id,
    (SELECT user_id FROM public.moves WHERE id = p_move_id),
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

  -- 4. 조건 변경으로 더 이상 해당 안 되는 미완료 항목 삭제
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
