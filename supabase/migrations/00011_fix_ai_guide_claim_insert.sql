-- Fix claim_ai_guide_generation so the first request after a cache miss owns generation.
-- Previous version inserted an in-flight row, then returned false because the follow-up
-- UPDATE did not match the freshly inserted generating_at value.

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
  v_inserted integer;
  v_row_count integer;
BEGIN
  INSERT INTO public.ai_guide_cache (cache_key, master_version, guides, generating_at)
  VALUES (p_cache_key, p_master_version, '[]'::jsonb, now())
  ON CONFLICT (cache_key) DO NOTHING
  RETURNING 1 INTO v_inserted;

  IF v_inserted = 1 THEN
    RETURN true;
  END IF;

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
