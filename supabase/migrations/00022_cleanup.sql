-- §3 cleanup (ADR-076): 익명 user 파기 / 휴지통 30일 영구삭제 / orphan 청소를
-- 단일 cleanup Edge Function이 처리. 이 마이그레이션은 환경 결합이 없는 안전한 부분만 담는다:
--   - 익명 cleanup 후보 선정 RPC (auth.users는 PostgREST 미노출 + admin.listUsers가 익명 제외라
--     SECURITY DEFINER SQL로 선정).
-- Cron 스케줄(pg_cron + pg_net + Vault)·verify_jwt=false 배포는 환경 의존이라
-- supabase/functions/cleanup/cron-setup.sql 로 분리(대시보드/SQL 에디터에서 수동 적용).

-- 익명 cleanup 후보:
--   last_activity_at = greatest(last_sign_in_at, max(moves/checklist/photos.updated_at), created_at)
--   대상 = is_anonymous AND last_activity_at < now() - p_inactive_days AND 미래 active move 없음(이사일 도래).
create or replace function public.get_anonymous_cleanup_candidates(p_inactive_days int default 30)
returns table (user_id uuid, last_activity_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  with activity as (
    select
      u.id as user_id,
      greatest(
        coalesce(u.last_sign_in_at, u.created_at),
        coalesce((select max(m.updated_at) from public.moves m where m.user_id = u.id), u.created_at),
        coalesce((select max(c.updated_at) from public.user_checklist_items c where c.user_id = u.id), u.created_at),
        coalesce((select max(p.updated_at) from public.property_photos p where p.user_id = u.id), u.created_at)
      ) as last_activity_at
    from auth.users u
    where u.is_anonymous = true
  )
  select a.user_id, a.last_activity_at
  from activity a
  where a.last_activity_at < now() - make_interval(days => p_inactive_days)
    -- 이사일 도래: 미래(오늘 이후) active move가 하나도 없을 것. 없으면 충족.
    and not exists (
      select 1
      from public.moves m
      where m.user_id = a.user_id
        and m.status = 'active'
        and m.deleted_at is null
        and m.moving_date >= current_date
    );
$$;

-- service_role(cleanup Edge Function)만 호출. 클라이언트 접근 차단.
revoke all on function public.get_anonymous_cleanup_candidates(int) from public;
revoke all on function public.get_anonymous_cleanup_candidates(int) from anon;
revoke all on function public.get_anonymous_cleanup_candidates(int) from authenticated;
grant execute on function public.get_anonymous_cleanup_candidates(int) to service_role;

comment on function public.get_anonymous_cleanup_candidates(int) is
  '익명 cleanup 후보 선정(ADR-076): last_activity_at가 p_inactive_days일 경과 + 미래 active move 없음(이사일 도래). 회원(is_anonymous=false)은 제외. service_role only — cleanup Edge Function 전용.';
