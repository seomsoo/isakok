-- 00027_push_send_rpcs.sql
-- send-notifications(service_role) 전용 서버 헬퍼 RPC (12단계 §7-2, ADR-094).
-- 스펙 §3은 4개 마이그레이션만 나열했으나, claim 모델을 supabase-js로 구현할 수 없어 추가:
--   notification_log의 멱등 인덱스가 "부분 유니크"(WHERE kind=...)라 PostgREST upsert의
--   onConflict(컬럼만 지정)로는 arbiter 인덱스를 못 맞춘다. INSERT ... ON CONFLICT (cols) WHERE pred
--   DO NOTHING은 SQL 함수에서만 가능하므로 claim을 RPC로 내린다. kst_today도 DB 기준 날짜 단일진실용.
-- 전부 service_role만 호출(REVOKE public + GRANT service_role).

-- KST 오늘 날짜. Deno 런타임은 UTC라 발송 함수가 날짜 계산을 DB로 고정한다.
CREATE OR REPLACE FUNCTION public.kst_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT (now() AT TIME ZONE 'Asia/Seoul')::date $$;
REVOKE ALL ON FUNCTION public.kst_today() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kst_today() TO service_role;

-- 마일스톤 claim. 부분 유니크(uq_log_milestone) 충돌 시 0 rows → NULL 반환(이미 발송).
CREATE OR REPLACE FUNCTION public.claim_milestone_notification(
  p_user_id   uuid,
  p_move_id   uuid,
  p_day       integer,
  p_date      date,
  p_sent_date date
)
RETURNS uuid
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.notification_log
    (user_id, move_id, kind, milestone_day, milestone_date, sent_date, status)
  VALUES
    (p_user_id, p_move_id, 'milestone', p_day, p_date, p_sent_date, 'claimed')
  ON CONFLICT (move_id, milestone_day, milestone_date) WHERE kind = 'milestone'
  DO NOTHING
  RETURNING id;
$$;
REVOKE ALL ON FUNCTION public.claim_milestone_notification(uuid, uuid, integer, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_milestone_notification(uuid, uuid, integer, date, date) TO service_role;

-- 다이제스트 claim. 부분 유니크(uq_log_digest) 충돌 시 0 rows → NULL 반환(이미 발송).
CREATE OR REPLACE FUNCTION public.claim_digest_notification(
  p_user_id   uuid,
  p_move_id   uuid,
  p_sent_date date
)
RETURNS uuid
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.notification_log
    (user_id, move_id, kind, sent_date, status)
  VALUES
    (p_user_id, p_move_id, 'digest', p_sent_date, 'claimed')
  ON CONFLICT (user_id, sent_date) WHERE kind = 'digest'
  DO NOTHING
  RETURNING id;
$$;
REVOKE ALL ON FUNCTION public.claim_digest_notification(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_digest_notification(uuid, uuid, date) TO service_role;
