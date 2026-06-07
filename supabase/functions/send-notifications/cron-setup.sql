-- 푸시 발송 — Supabase Cron 스케줄 (12단계 §8, ADR-094)
-- 자동 마이그레이션이 아님. 환경 의존(Vault 시크릿·함수 배포 플래그)이라 SQL 에디터/대시보드에서 수동 실행한다.
--
-- ── 사전 준비 ──────────────────────────────────────────────────────────────
--  1) 함수 배포 (config.toml에 [functions.send-notifications] verify_jwt=false 선언됨):
--       supabase functions deploy send-notifications
--       supabase functions deploy register-push-token
--  2) 함수 시크릿:
--       supabase secrets set PUSH_CRON_TOKEN="$(openssl rand -hex 32)"
--       supabase secrets set PUSH_DRY_RUN=true   # 첫 1회는 평가만 로깅 → structured log 확인 후 false 전환
--  3) Vault 시크릿 (아래 SQL). push_cron_token 값은 위 PUSH_CRON_TOKEN과 동일해야 함:
--       select vault.create_secret('<PUSH_CRON_TOKEN 값>', 'push_cron_token');
--     project_url은 cleanup에서 이미 등록했다면 재사용:
--       select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
-- ───────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 매일 00:00 UTC = 09:00 KST (서머타임 없음). 같은 jobname은 upsert(재실행 안전).
select cron.schedule(
  'send-notifications-daily',
  '0 0 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);

-- ── 점검 ──
--   select jobid, schedule, jobname, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 5;
--   해제: select cron.unschedule('send-notifications-daily');
-- 첫 수동 실행(DRY_RUN 확인 — Edge 로그의 send.run mode=DRY_RUN, send.dryrun 확인):
--   curl -X POST "$PROJECT_URL/functions/v1/send-notifications" -H "Authorization: Bearer $PUSH_CRON_TOKEN"
