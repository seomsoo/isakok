-- Kakao 같은 custom auth provider와 Supabase user 매핑
-- Supabase native identity가 아니라 앱 레벨 매핑 (ADR-048)
CREATE TABLE public.auth_provider_links (
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (provider, provider_user_id),
  CONSTRAINT auth_provider_links_provider_check
    CHECK (provider IN ('kakao'))
);

CREATE INDEX idx_auth_provider_links_user_id
  ON public.auth_provider_links(user_id);

ALTER TABLE public.auth_provider_links ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.auth_provider_links IS
  '외부 OAuth provider와 Supabase user 매핑. Kakao 같은 OIDC 미지원 provider 용도. RLS 활성 + 정책 0개 = service_role만 접근 가능.';
