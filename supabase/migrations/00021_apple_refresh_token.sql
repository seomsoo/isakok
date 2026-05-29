-- Apple Sign in token revoke (ADR-077)
-- 계정 삭제 시 Apple revoke endpoint 호출에 필요한 refresh_token을 보관.
-- auth_provider_links에 보관하므로 Apple도 매핑 행을 가질 수 있도록 provider CHECK 완화.
--
-- 보안: auth_provider_links는 RLS 활성 + 정책 0개라 service_role만 접근 가능(클라이언트 SELECT/UPDATE 불가).
--       apple_refresh_token도 이 테이블의 일부이므로 자동으로 service_role only.
--       pgsodium TCE는 신규 도입하지 않음 — Supabase가 신규 사용 비권장(deprecation 예정)이고,
--       Supabase 기본 at-rest 암호화 + service_role only로 충분(ADR-077).

ALTER TABLE public.auth_provider_links
  DROP CONSTRAINT auth_provider_links_provider_check;

ALTER TABLE public.auth_provider_links
  ADD CONSTRAINT auth_provider_links_provider_check
  CHECK (provider IN ('kakao', 'apple'));

ALTER TABLE public.auth_provider_links
  ADD COLUMN apple_refresh_token text;

COMMENT ON COLUMN public.auth_provider_links.apple_refresh_token IS
  'Apple Sign in refresh_token (provider=apple 행만 사용). service_role only — RLS 정책 0개라 클라이언트 접근 불가. delete-account가 Apple revoke 호출 시 읽음. pgsodium 미사용(ADR-077).';
