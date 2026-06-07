// send-notifications (12단계 §7-2, ADR-094). Supabase Cron 전용 서버-서버 함수.
// 매일 09:00 KST: current active move 기준으로 데일리 다이제스트 + D-day 마일스톤을 평가해
// notification_log claim 모델로 멱등 발송. verify_jwt=false(config.toml) + PUSH_CRON_TOKEN 내부 검증.
// 첫 배포는 PUSH_DRY_RUN=true로 평가만 로깅 → 확인 후 false 전환(실유저 직발송, ADR-075 dev=prod).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { log } from '../_shared/logger.ts'
import { getKstToday, diffCalendarDays } from './kstDate.ts'
import { isMilestoneDay, decideSend } from './buildMessage.ts'
import { sendExpoPush } from './expoPush.ts'
import type { ExpoMessage, ExpoTicket } from './expoPush.ts'

// 1회 처리 상한 (리뷰 #17). 초과 시 truncated=true 로그 — 분산 발송은 후속.
const MAX_USERS = 500
const MAX_TOKENS = 1000
// ticket-level 무효 토큰 정리 대상 (receipt polling 정밀 정리는 후속, 리뷰 #9).
const INVALID_TOKEN_ERRORS = new Set(['DeviceNotRegistered', 'InvalidCredentials'])
// 첫 항목 정렬 우선순위 (critical→warning→sort_order).
const GUIDE_PRIORITY: Record<string, number> = { critical: 0, warning: 1, tip: 2 }

interface PendingItem {
  title: string
  guide_type: string
  sort_order: number
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // 1) 내부 토큰 검증 (cleanup 패턴). 미설정/불일치는 거부.
  const expected = Deno.env.get('PUSH_CRON_TOKEN')
  if (!expected || req.headers.get('Authorization') !== `Bearer ${expected}`) {
    return json({ error: 'unauthorized' }, 401)
  }

  const dryRun = Deno.env.get('PUSH_DRY_RUN') === 'true'
  const admin = supabaseAdmin
  const startedAt = new Date().toISOString()

  // 2) KST today (DB 기준)
  let kstToday: string
  try {
    kstToday = await getKstToday(admin)
  } catch (e) {
    log({
      event: 'send.error',
      stage: 'kst_today',
      message: e instanceof Error ? e.message : String(e),
    })
    return json({ error: 'kst_today failed' }, 500)
  }

  // 3) 대상: push_enabled=true 유저 + 그들의 토큰
  const { data: enabledUsers, error: uErr } = await admin
    .from('users')
    .select('id')
    .eq('push_enabled', true)
  if (uErr) {
    log({ event: 'send.error', stage: 'users', message: uErr.message })
    return json({ error: 'users query failed' }, 500)
  }
  const enabledIds = (enabledUsers ?? []).map((u) => u.id as string)

  const tokensByUser = new Map<string, string[]>()
  if (enabledIds.length > 0) {
    const { data: tokenRows, error: tErr } = await admin
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', enabledIds)
    if (tErr) {
      log({ event: 'send.error', stage: 'tokens', message: tErr.message })
      return json({ error: 'tokens query failed' }, 500)
    }
    for (const r of tokenRows ?? []) {
      const uid = r.user_id as string
      const arr = tokensByUser.get(uid) ?? []
      arr.push(r.token as string)
      tokensByUser.set(uid, arr)
    }
  }

  let targetUsers = 0
  let targetTokens = 0
  let claimed = 0
  let truncated = false

  // 발송 outbox: 메시지와 메타(유저·토큰)를 평행 배열로 (ticket 순서 매핑).
  const messages: ExpoMessage[] = []
  const meta: { userId: string; token: string }[] = []
  // 유저별 claim된 log id (전송 결과로 sent/failed 갱신).
  const claimedLogsByUser = new Map<string, string[]>()

  for (const userId of tokensByUser.keys()) {
    if (targetUsers >= MAX_USERS || targetTokens >= MAX_TOKENS) {
      truncated = true
      break
    }
    const tokens = tokensByUser.get(userId) ?? []
    if (tokens.length === 0) continue
    targetUsers++
    targetTokens += tokens.length

    // 4) current active move 1개 (getCurrentMove와 동일: status='active', 미삭제, created_at desc)
    const { data: move, error: mErr } = await admin
      .from('moves')
      .select('id, moving_date')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (mErr) {
      log({ event: 'send.user.error', stage: 'move', userId, message: mErr.message })
      continue
    }
    if (!move) continue

    const moveId = move.id as string
    const dDay = diffCalendarDays(kstToday, move.moving_date as string)

    // 5) pending: assigned_date <= kstToday & 미완료. 첫 항목(critical→warning→sort_order).
    const { data: itemRows, error: iErr } = await admin
      .from('user_checklist_items')
      .select('master:master_checklist_items!inner(title, guide_type, sort_order)')
      .eq('move_id', moveId)
      .eq('is_completed', false)
      .lte('assigned_date', kstToday)
    if (iErr) {
      log({ event: 'send.user.error', stage: 'pending', userId, message: iErr.message })
      continue
    }
    const items: PendingItem[] = (itemRows ?? []).map((r) => {
      const raw = (r as { master: PendingItem | PendingItem[] }).master
      const m = Array.isArray(raw) ? raw[0] : raw
      return {
        title: m?.title ?? '',
        guide_type: m?.guide_type ?? 'tip',
        sort_order: m?.sort_order ?? 0,
      }
    })
    const pending = items.length
    const firstItem =
      pending === 0
        ? null
        : [...items].sort((a, b) => {
            const pa = GUIDE_PRIORITY[a.guide_type] ?? 9
            const pb = GUIDE_PRIORITY[b.guide_type] ?? 9
            return pa !== pb ? pa - pb : a.sort_order - b.sort_order
          })[0].title

    const milestone = isMilestoneDay(dDay)

    // DRY_RUN: 평가만 로그, claim/전송 생략
    if (dryRun) {
      if (milestone || pending > 0) {
        log({
          event: 'send.dryrun',
          userId,
          moveId,
          dDay,
          pending,
          isMilestone: milestone,
          tokens: tokens.length,
        })
      }
      continue
    }

    // 6) claim (멱등 선점). RPC가 0 rows(이미 claimed/sent)면 null.
    let milestoneClaimed = false
    let digestClaimed = false
    const logIds: string[] = []

    if (milestone) {
      const { data: mid, error } = await admin.rpc('claim_milestone_notification', {
        p_user_id: userId,
        p_move_id: moveId,
        p_day: dDay,
        p_date: kstToday,
        p_sent_date: kstToday,
      })
      if (error) {
        log({ event: 'send.user.error', stage: 'claim_milestone', userId, message: error.message })
      } else if (mid) {
        milestoneClaimed = true
        claimed++
        logIds.push(mid as string)
      }
    }
    if (pending > 0) {
      const { data: did, error } = await admin.rpc('claim_digest_notification', {
        p_user_id: userId,
        p_move_id: moveId,
        p_sent_date: kstToday,
      })
      if (error) {
        log({ event: 'send.user.error', stage: 'claim_digest', userId, message: error.message })
      } else if (did) {
        digestClaimed = true
        claimed++
        logIds.push(did as string)
      }
    }

    const built = decideSend({ dDay, pending, firstItem, milestoneClaimed, digestClaimed })
    if (!built || logIds.length === 0) continue

    claimedLogsByUser.set(userId, logIds)
    for (const token of tokens) {
      messages.push({
        to: token,
        title: built.title,
        body: built.body,
        data: { route: built.route },
        channelId: 'default',
      })
      meta.push({ userId, token })
    }
  }

  // 7) 전송 + 8) ticket 처리
  let sentLogs = 0
  let failedLogs = 0
  let deletedTokens = 0

  if (!dryRun && messages.length > 0) {
    const tickets: ExpoTicket[] = await sendExpoPush(messages)

    const userSucceeded = new Set<string>()
    const invalidTokens: string[] = []
    for (let i = 0; i < meta.length; i++) {
      const t = tickets[i]
      const m = meta[i]
      if (t && t.status === 'ok') {
        userSucceeded.add(m.userId)
      } else {
        const err = t?.details?.error
        if (err && INVALID_TOKEN_ERRORS.has(err)) invalidTokens.push(m.token)
      }
    }

    // 무효 토큰 삭제 (ticket-level만 — receipt polling은 후속)
    if (invalidTokens.length > 0) {
      const { error } = await admin.from('push_tokens').delete().in('token', invalidTokens)
      if (error) log({ event: 'send.error', stage: 'delete_tokens', message: error.message })
      else deletedTokens = invalidTokens.length
    }

    // log status: 유저 토큰 중 하나라도 성공 → sent, 전부 실패 → failed (token-level 기록은 후속)
    const now = new Date().toISOString()
    const sentIds: string[] = []
    const failedIds: string[] = []
    for (const [userId, ids] of claimedLogsByUser) {
      if (userSucceeded.has(userId)) sentIds.push(...ids)
      else failedIds.push(...ids)
    }
    if (sentIds.length > 0) {
      const { error } = await admin
        .from('notification_log')
        .update({ status: 'sent', sent_at: now })
        .in('id', sentIds)
      if (error) log({ event: 'send.error', stage: 'mark_sent', message: error.message })
      else sentLogs = sentIds.length
    }
    if (failedIds.length > 0) {
      const { error } = await admin
        .from('notification_log')
        .update({ status: 'failed', error: 'expo ticket error', sent_at: now })
        .in('id', failedIds)
      if (error) log({ event: 'send.error', stage: 'mark_failed', message: error.message })
      else failedLogs = failedIds.length
    }
  }

  // 10) structured summary
  const summary = {
    event: 'send.run',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
    kstToday,
    targetUsers,
    targetTokens,
    messages: messages.length,
    claimed,
    sent: sentLogs,
    failed: failedLogs,
    deletedTokens,
    truncated,
  }
  log(summary)
  return json(summary, 200)
})
