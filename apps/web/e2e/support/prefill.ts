import { type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_STORAGE_KEY } from '@moving/shared'

interface PrefillOptions {
  housingType?: string
  contractType?: string
  moveType?: string
  /** 이사일을 오늘로부터 며칠 뒤로 둘지 (기본 8일 — 밀린/오늘 할 일이 생겨 대시보드 액션 항목 확보) */
  daysUntilMove?: number
}

/** Date를 로컬 YYYY-MM-DD로 (UTC 변환 하루 밀림 방지 — parseLocalDate와 짝) */
function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * prefill — 새 익명 유저 + move(맞춤 체크리스트)를 API(RPC)로 미리 만들고 그 세션을 브라우저에 주입한다.
 *
 * 온보딩 UI 풀코스를 거치지 않고 "대시보드에 체크리스트가 있는 상태"에서 바로 시작하기 위함.
 * 빠르고(클릭 0), 독립적이며(테스트마다 자기 유저+move), 온보딩 변경에 안 깨진다(영상 prefill, 19:38).
 * 온보딩 자체 검증은 flows/onboarding.spec.ts가 담당 — 여기선 그 결과 상태만 API로 재현.
 *
 * @returns 생성된 moveId
 */
export async function prefillMoveAndAuth(page: Page, opts: PrefillOptions = {}): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 미설정 — .env.test 확인')
  }

  // 1. 새 익명 세션 (이 클라이언트가 곧 그 유저로 authed → RPC ownership 가드 통과)
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data: auth, error: authError } = await supabase.auth.signInAnonymously()
  if (authError) throw authError
  const session = auth.session
  if (!session) throw new Error('익명 세션 발급 실패(session null)')

  // 2. move + 체크리스트 생성 (온보딩이 내부에서 부르는 바로 그 RPC를 직접 호출)
  const moving = new Date()
  moving.setDate(moving.getDate() + (opts.daysUntilMove ?? 8))
  const { data: moveId, error: rpcError } = await supabase.rpc('create_move_with_checklist', {
    p_moving_date: localYmd(moving),
    p_housing_type: opts.housingType ?? '원룸',
    p_contract_type: opts.contractType ?? '월세',
    p_move_type: opts.moveType ?? '용달',
    p_is_first_move: false,
    p_from_address: null,
    p_to_address: null,
    p_user_id: session.user.id,
  })
  if (rpcError) throw rpcError

  // 3. 세션을 브라우저 localStorage에 주입 (seed.spec과 동일 방식·단일 출처 키)
  await page.goto('/')
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), {
    key: SUPABASE_STORAGE_KEY,
    value: session,
  })

  return moveId as string
}
