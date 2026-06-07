-- 00024_notification_log.sql
-- 발송 멱등 + 실패 가시성 (12단계 §3-2, ADR-094). claim 모델.
-- claimed(선점) → 전송 → sent/failed. 발송 전 insert만 하면 전송 실패가 다음 Cron에서
-- conflict로 "이미 발송"으로 영구 skip되므로 status를 분리한다. 재시도는 MVP에서 안 함(failed 기록만).

CREATE TABLE public.notification_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  move_id        uuid REFERENCES public.moves(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('digest','milestone')),
  milestone_day  integer,                            -- 7|3|1|0, digest는 NULL
  milestone_date date,                               -- 마일스톤이 발생한 KST 날짜 (digest는 NULL)
  sent_date      date NOT NULL,                       -- KST 발송 시도일
  status         text NOT NULL DEFAULT 'claimed'
                   CHECK (status IN ('claimed','sent','failed')),
  sent_at        timestamptz,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 멱등성 (DB 레벨). claim 단계에서 ON CONFLICT DO NOTHING으로 선점.
-- 다이제스트: 유저+날짜당 1회
CREATE UNIQUE INDEX uq_log_digest
  ON public.notification_log(user_id, sent_date) WHERE kind = 'digest';
-- 마일스톤: move+시점+시점날짜당 1회 (이사일 변경 시 milestone_date가 달라져 새 알림 허용)
CREATE UNIQUE INDEX uq_log_milestone
  ON public.notification_log(move_id, milestone_day, milestone_date) WHERE kind = 'milestone';

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = service_role만 (유저 직접 접근 불필요)
