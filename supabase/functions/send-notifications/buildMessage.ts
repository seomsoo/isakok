import { digestContent, milestoneContent, mergedContent } from './copy.ts'
import type { PushContent } from './copy.ts'

export const MILESTONE_DAYS = [7, 3, 1, 0] as const

/** dDay가 마일스톤 시점(7/3/1/0)인지 */
export function isMilestoneDay(dDay: number): boolean {
  return (MILESTONE_DAYS as readonly number[]).includes(dDay)
}

export type SendKind = 'merged' | 'milestone' | 'digest'

export interface BuiltMessage extends PushContent {
  kind: SendKind
  route: string
}

/**
 * claim 결과로 발송 내용 결정 (유저당 최대 1건 — 중복 피로 방지, 리뷰 #15).
 * - 둘 다 신규 claim → 병합 (마일스톤+다이제스트)
 * - 마일스톤만 신규 → 마일스톤 (D-3은 pending을 본문에 병합)
 * - 다이제스트만 신규 → 다이제스트
 * - 둘 다 아님(이미 발송/비대상) → null
 * claim이 0 rows(이미 발송)면 자연히 단독/없음으로 떨어져 "병합 skip"이 성립한다.
 */
export function decideSend(args: {
  dDay: number
  pending: number
  firstItem: string | null
  milestoneClaimed: boolean
  digestClaimed: boolean
}): BuiltMessage | null {
  const { dDay, pending, firstItem, milestoneClaimed, digestClaimed } = args
  const route = '/dashboard'
  const item = firstItem ?? '오늘 할 일'

  if (milestoneClaimed && digestClaimed) {
    return { kind: 'merged', route, ...mergedContent(dDay, item, pending) }
  }
  if (milestoneClaimed) {
    return { kind: 'milestone', route, ...milestoneContent(dDay, pending) }
  }
  if (digestClaimed) {
    return { kind: 'digest', route, ...digestContent(item, pending) }
  }
  return null
}
