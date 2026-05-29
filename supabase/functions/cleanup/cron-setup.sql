-- §3 cleanup — Supabase Cron 스케줄 (ADR-076)
-- 자동 마이그레이션이 아님. 환경 의존(Vault 시크릿·함수 배포 플래그)이라 SQL 에디터/대시보드에서 수동 실행한다.
--
-- ── 사전 준비 ──────────────────────────────────────────────────────────────
--  1) cleanup 함수 배포 (verify_jwt 비활성 — Cron이 플랫폼 JWT가 아닌 커스텀 토큰으로 호출):
--       supabase functions deploy cleanup --no-verify-jwt
--  2) 함수 시크릿:
--       supabase secrets set CLEANUP_TOKEN="$(openssl rand -hex 32)"
--       supabase secrets set DRY_RUN=true     # 첫 1주는 DRY_RUN으로 후보 검증 → 확인 후 false 전환
--  3) Vault 시크릿 (아래 SQL). cleanup_token 값은 위 CLEANUP_TOKEN과 동일해야 함:
--       select vault.create_secret('<CLEANUP_TOKEN 값>', 'cleanup_token');
--       select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
-- ───────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 매일 KST 03:00 (UTC 18:00) cleanup 호출. 같은 jobname은 upsert(재실행 안전).
select cron.schedule(
  'daily-cleanup',
  '0 18 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
  $cron$
);

-- ── 점검 ──
--   select jobid, schedule, jobname, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 5;
--   해제: select cron.unschedule('daily-cleanup');
-- 첫 수동 실행(DRY_RUN 확인):
--   curl -X POST "$PROJECT_URL/functions/v1/cleanup" -H "Authorization: Bearer $CLEANUP_TOKEN"
