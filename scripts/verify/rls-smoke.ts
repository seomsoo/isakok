/**
 * RLS Smoke Test — 수동 실행 (CI 미연결)
 *
 * 두 익명 세션(A, B)을 생성해 격리를 검증한다.
 * A가 만든 move를 B가 조회/수정/삭제 시도 → 0건/실패 확인.
 *
 * 실행:
 *   SUPABASE_URL=https://... SUPABASE_ANON_KEY=... npx tsx scripts/verify/rls-smoke.ts
 *
 * ⚠️ 테스트 데이터를 생성하므로 dev 환경에서만 실행.
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY

if (!URL || !ANON) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY required')
  process.exit(1)
}

function client() {
  return createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function createAnonymousSession() {
  const sb = client()
  const { data, error } = await sb.auth.signInAnonymously()
  if (error) throw new Error(`signInAnonymously: ${error.message}`)
  return { sb, userId: data.user!.id, session: data.session! }
}

let passed = 0
let failed = 0

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    failed++
  }
}

async function main() {
  console.log('Creating anonymous sessions A and B...')
  const a = await createAnonymousSession()
  const b = await createAnonymousSession()
  assert('A and B have different user IDs', a.userId !== b.userId)

  // A creates a move
  console.log('\n[A] Creating move...')
  const { data: moveId, error: createErr } = await a.sb.rpc('create_move_with_checklist', {
    p_user_id: a.userId,
    p_moving_date: '2026-07-01',
    p_housing_type: '원룸',
    p_contract_type: '월세',
    p_move_type: '용달',
    p_is_first_move: true,
  })
  assert('A move created', !createErr && !!moveId)

  // A can see own move
  const { data: aMoves } = await a.sb.from('moves').select('id').eq('id', moveId)
  assert('A sees own move', aMoves?.length === 1)

  // B cannot see A's move
  console.log("\n[B] Attempting to access A's data...")
  const { data: bMoves } = await b.sb.from('moves').select('id').eq('id', moveId)
  assert('B cannot see A move (0 rows)', bMoves?.length === 0)

  // B cannot update A's move
  const { data: bUpdate } = await b.sb
    .from('moves')
    .update({ from_address: 'hacked' })
    .eq('id', moveId)
    .select()
  assert('B cannot update A move (0 rows)', !bUpdate || bUpdate.length === 0)

  // B cannot see A's checklist items
  const { data: bItems } = await b.sb
    .from('user_checklist_items')
    .select('id')
    .eq('move_id', moveId)
  assert('B cannot see A checklist items (0 rows)', bItems?.length === 0)

  // A can see own checklist items
  const { data: aItems } = await a.sb
    .from('user_checklist_items')
    .select('id')
    .eq('move_id', moveId)
  assert('A sees own checklist items (>0)', (aItems?.length ?? 0) > 0)

  // master_checklist_items: both can read
  console.log('\n[Public tables]')
  const { data: aMaster } = await a.sb.from('master_checklist_items').select('id').limit(1)
  const { data: bMaster } = await b.sb.from('master_checklist_items').select('id').limit(1)
  assert('A reads master_checklist_items', (aMaster?.length ?? 0) > 0)
  assert('B reads master_checklist_items', (bMaster?.length ?? 0) > 0)

  // system_config: both can read
  const { data: aConfig } = await a.sb.from('system_config').select('key').limit(1)
  const { data: bConfig } = await b.sb.from('system_config').select('key').limit(1)
  assert('A reads system_config', (aConfig?.length ?? 0) > 0)
  assert('B reads system_config', (bConfig?.length ?? 0) > 0)

  // ai_guide_cache: neither can read (service_role only)
  // seed a row via service_role, then verify authenticated can't see it
  console.log('\n[service_role only tables]')
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
  let cacheSeeded = false
  if (SERVICE) {
    const admin = createClient(URL!, SERVICE, { auth: { persistSession: false } })
    await admin.from('ai_guide_cache').upsert(
      {
        cache_key: '__rls_smoke_test__',
        master_version: 0,
        guides: [],
      },
      { onConflict: 'cache_key' },
    )
    cacheSeeded = true
  }

  const { data: aCache, error: aCacheErr } = await a.sb.from('ai_guide_cache').select('id').limit(1)
  if (cacheSeeded) {
    assert(
      'A cannot read ai_guide_cache (seeded row invisible)',
      !!aCacheErr || (aCache?.length ?? 0) === 0,
    )
  } else {
    console.log(
      '  ⚠ SUPABASE_SERVICE_ROLE_KEY not set — cache test may false-positive on empty table',
    )
    assert('A cannot read ai_guide_cache (no seed)', !!aCacheErr || (aCache?.length ?? 0) === 0)
  }

  // users: A sees own, B cannot see A
  console.log('\n[users table]')
  const { data: aUser } = await a.sb.from('users').select('id').eq('id', a.userId)
  assert('A sees own user row', aUser?.length === 1)
  const { data: bSeesA } = await b.sb.from('users').select('id').eq('id', a.userId)
  assert('B cannot see A user row', bSeesA?.length === 0)

  // users: UPDATE blocked
  const { data: aUserUpdate } = await a.sb
    .from('users')
    .update({ provider: 'hacked' })
    .eq('id', a.userId)
    .select()
  assert(
    'A cannot UPDATE own user (provider tamper blocked)',
    !aUserUpdate || aUserUpdate.length === 0,
  )

  // Storage: B cannot get signed URL for A's path
  console.log('\n[Storage isolation]')
  const fakePhotoPath = `${a.userId}/${moveId}/room_test.jpg`
  const { data: bSignedUrl, error: bSignedErr } = await b.sb.storage
    .from('property-photos')
    .createSignedUrl(fakePhotoPath, 60)
  assert('B cannot get signed URL for A photo path', !!bSignedErr || !bSignedUrl?.signedUrl)

  // Cleanup: soft delete move (A)
  console.log('\n[Cleanup]')
  await a.sb.from('moves').update({ deleted_at: new Date().toISOString() }).eq('id', moveId)

  console.log(`\n${'='.repeat(40)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
