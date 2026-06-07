-- 00023_push_tokens.sql
-- 푸시 토큰 저장 (12단계 §3-1, ADR-093). ExpoPushToken ↔ user 매핑.
-- service_role only: anon/authenticated 직접 접근 전면 차단. 등록은 register-push-token
-- Edge Function(JWT 검증 후 service_role upsert)만 처리한다.
--   - 본인 RLS를 검토했으나, 같은 토큰이 user A에 붙은 상태에서 user B가 onConflict:token upsert 시
--     ON CONFLICT DO UPDATE가 A의 row를 갱신해야 하는데 USING(auth.uid()=user_id)가 막아 재할당 실패
--     (기기 양도·재설치·계정삭제 후 새 익명에서 발생) → service_role 등록으로 회피.
-- on delete cascade: 익명 cleanup(ADR-076)·계정삭제(ADR-082)가 user 삭제 시 토큰 자동 정리.

CREATE TABLE public.push_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,                 -- ExpoPushToken
  platform     text NOT NULL CHECK (platform IN ('ios','android')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_tokens_user_id ON public.push_tokens(user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = anon/authenticated 직접 접근 전면 차단. 등록은 register-push-token(service_role)만.
