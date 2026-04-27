-- system_config: master_checklist_version 관리용 single-row 테이블

CREATE TABLE IF NOT EXISTS public.system_config (
  key text PRIMARY KEY,
  value integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.system_config
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.system_config (key, value) VALUES ('master_checklist_version', 1)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_config_read_all"
ON public.system_config FOR SELECT
USING (true);
