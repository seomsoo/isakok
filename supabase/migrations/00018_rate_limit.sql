-- 00018_rate_limit.sql
-- rate_limit_log 테이블 + increment_rate_limit 원자적 RPC

CREATE TABLE public.rate_limit_log (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX idx_rate_limit_log_window_start ON public.rate_limit_log (window_start);

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

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

  DELETE FROM public.rate_limit_log WHERE window_start < now() - interval '2 days';

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_rate_limit FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit TO service_role;
