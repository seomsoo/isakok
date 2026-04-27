-- ai_guide_cache: in-flight lock 컬럼 추가 + RPC 2개

-- 1) generating_at 컬럼 추가
ALTER TABLE public.ai_guide_cache
ADD COLUMN IF NOT EXISTS generating_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ai_guide_cache_key
ON public.ai_guide_cache(cache_key);

-- 2) lock 획득 RPC (원자적 — ADR-019)
CREATE OR REPLACE FUNCTION public.claim_ai_guide_generation(
  p_cache_key text,
  p_master_version integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_count integer;
BEGIN
  INSERT INTO public.ai_guide_cache (cache_key, master_version, guides, generating_at)
  VALUES (p_cache_key, p_master_version, '[]'::jsonb, now())
  ON CONFLICT (cache_key) DO NOTHING;

  UPDATE public.ai_guide_cache
  SET generating_at = now(),
      master_version = p_master_version
  WHERE cache_key = p_cache_key
    AND (
      generating_at IS NULL
      OR generating_at < now() - interval '30 seconds'
      OR master_version <> p_master_version
    );

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ai_guide_generation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_ai_guide_generation TO service_role;

-- 3) custom_guide batch 적용 RPC
CREATE OR REPLACE FUNCTION public.apply_ai_guides(
  p_move_id uuid,
  p_guides jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.user_checklist_items u
  SET custom_guide = g.custom_guide
  FROM jsonb_to_recordset(p_guides)
    AS g(master_item_id uuid, custom_guide text)
  WHERE u.move_id = p_move_id
    AND u.master_item_id = g.master_item_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ai_guides FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_ai_guides TO service_role;
