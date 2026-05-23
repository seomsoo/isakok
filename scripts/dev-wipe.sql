-- dev-wipe.sql
-- dev 환경 사용자 데이터 전부 삭제 (master/cache/config 보존)
-- ⚠️ 실행 전 반드시 project-ref가 dev(ybcqinanfcarhqkclvue)인지 확인!
--
-- 실행 방법:
--   1) supabase status → ref가 ybcqinanfcarhqkclvue인지 확인
--   2) 아래 SQL을 Supabase SQL Editor 또는 psql로 실행
--   3) auth.users는 Supabase 대시보드 > Authentication > Users에서 전체 삭제
--      (admin API: supabase.auth.admin.listUsers() → deleteUser() 루프)
--   4) auth.users 삭제 시 public.users는 FK CASCADE로 자동 삭제됨
--
-- FK CASCADE 체인:
--   auth.users 삭제 → public.users CASCADE
--   public.users 삭제 → moves, property_photos, user_checklist_items, auth_provider_links CASCADE
--   따라서 auth.users만 삭제하면 앱 데이터 전부 정리됨.
--   아래 SQL은 auth.users 접근이 안 되는 환경에서 앱 데이터만 먼저 정리할 때 사용.

-- 1) 앱 데이터 (child rows부터, FK 순서)
DELETE FROM public.auth_provider_links;
DELETE FROM public.rate_limit_log;
DELETE FROM public.property_photos;
DELETE FROM public.user_checklist_items;
DELETE FROM public.moves;

-- 2) public.users (auth.users FK CASCADE로 이미 삭제됐으면 0건)
DELETE FROM public.users;

-- 3) Storage 파일 (SQL로 직접 삭제)
DELETE FROM storage.objects WHERE bucket_id = 'property-photos';

-- 보존 확인
SELECT 'master_checklist_items' AS "table", count(*) AS "count" FROM public.master_checklist_items
UNION ALL
SELECT 'ai_guide_cache', count(*) FROM public.ai_guide_cache
UNION ALL
SELECT 'system_config', count(*) FROM public.system_config
UNION ALL
SELECT 'moves (should be 0)', count(*) FROM public.moves
UNION ALL
SELECT 'users (should be 0)', count(*) FROM public.users;

-- master_version 정합성 확인 (cache 버전이 system_config와 일치하는지)
SELECT
  c.master_version AS cache_version,
  (s.value)::int AS config_version,
  CASE WHEN c.master_version = (s.value)::int THEN '✓ OK' ELSE '✗ MISMATCH' END AS status
FROM (SELECT DISTINCT master_version FROM public.ai_guide_cache) c
CROSS JOIN (SELECT value FROM public.system_config WHERE key = 'master_checklist_version') s;
