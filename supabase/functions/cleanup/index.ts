import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { log } from '../_shared/logger.ts'
import { deleteUserCompletely, DeleteUserError } from '../_shared/deleteUserData.ts'

// §3 cleanup (ADR-076): 단일 Edge Function이 3가지 처리.
//   1) 익명 user 파기 (last_activity_at 30일 + 이사일 도래) — _shared/deleteUserData 재사용
//   2) 휴지통 사진 30일 영구삭제 (06단계 daysLeft 실현)
//   3) orphan 파일 청소 (Storage엔 있으나 DB 매칭 없고 24h 경과)
// 호출: Supabase Cron(pg_net) + Vault 토큰. DRY_RUN=true면 후보만 로그(삭제 X).

const BUCKET = 'property-photos'
const LIST_PAGE_SIZE = 1000
const REMOVE_CHUNK_SIZE = 100
const DB_PAGE_SIZE = 1000
const INACTIVE_DAYS = 30
const TRASH_RETENTION_DAYS = 30
const ORPHAN_GRACE_HOURS = 24

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** 임의 경로 목록을 chunk 단위로 Storage에서 제거. */
async function removeStoragePaths(
  admin: SupabaseClient,
  paths: string[],
): Promise<{ removed: number; errors: number }> {
  let removed = 0
  let errors = 0
  for (const chunk of chunkArray(paths, REMOVE_CHUNK_SIZE)) {
    const { error } = await admin.storage.from(BUCKET).remove(chunk)
    if (error) {
      console.warn(`[cleanup:storage-remove] chunk_size=${chunk.length} error=${error.message}`)
      errors += chunk.length
    } else {
      removed += chunk.length
    }
  }
  return { removed, errors }
}

// 1) 익명 user 파기 — RPC로 후보 선정 후 각각 deleteUserCompletely
async function cleanupAnonymousUsers(
  admin: SupabaseClient,
  dryRun: boolean,
): Promise<{ candidates: number; deleted: number; errors: number }> {
  const { data, error } = await admin.rpc('get_anonymous_cleanup_candidates', {
    p_inactive_days: INACTIVE_DAYS,
  })
  if (error) throw new Error(`candidates query failed: ${error.message}`)
  const candidates = (data ?? []) as { user_id: string; last_activity_at: string }[]

  if (dryRun) {
    for (const c of candidates) {
      log({ event: 'cleanup.anon.dryrun', userId: c.user_id, lastActivityAt: c.last_activity_at })
    }
    return { candidates: candidates.length, deleted: 0, errors: 0 }
  }

  let deleted = 0
  let errors = 0
  for (const c of candidates) {
    try {
      await deleteUserCompletely(admin, c.user_id)
      deleted++
    } catch (err) {
      errors++
      const stage = err instanceof DeleteUserError ? err.stage : 'unknown'
      log({ event: 'cleanup.anon.error', userId: c.user_id, stage })
    }
  }
  return { candidates: candidates.length, deleted, errors }
}

// 2) 휴지통 30일 경과 영구삭제 — Storage 제거 + DB 행 delete
async function cleanupTrash(
  admin: SupabaseClient,
  dryRun: boolean,
): Promise<{ count: number; deleted: number; errors: number }> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000).toISOString()
  const { data, error } = await admin
    .from('property_photos')
    .select('id, storage_path')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
  if (error) throw new Error(`trash query failed: ${error.message}`)
  const rows = (data ?? []) as { id: string; storage_path: string }[]

  if (dryRun) {
    log({ event: 'cleanup.trash.dryrun', count: rows.length })
    return { count: rows.length, deleted: 0, errors: 0 }
  }
  if (rows.length === 0) return { count: 0, deleted: 0, errors: 0 }

  const { errors } = await removeStoragePaths(
    admin,
    rows.map((r) => r.storage_path),
  )
  const { error: delErr } = await admin
    .from('property_photos')
    .delete()
    .in(
      'id',
      rows.map((r) => r.id),
    )
  if (delErr) throw new Error(`trash db delete failed: ${delErr.message}`)
  return { count: rows.length, deleted: rows.length, errors }
}

// 3) orphan 청소 — 전체 Storage 파일 vs DB storage_path 차집합, 24h 유예
async function listAllStorageFiles(
  admin: SupabaseClient,
): Promise<{ path: string; createdAt: string | null }[]> {
  const bucket = admin.storage.from(BUCKET)
  const out: { path: string; createdAt: string | null }[] = []
  const { data: lvl0, error: e0 } = await bucket.list('', { limit: LIST_PAGE_SIZE })
  if (e0) throw new Error(`orphan list lvl0 failed: ${e0.message}`)
  for (const u of lvl0 ?? []) {
    if (u.id !== null) continue // 최상위는 userId 폴더만 기대
    const { data: lvl1, error: e1 } = await bucket.list(u.name, { limit: LIST_PAGE_SIZE })
    if (e1) throw new Error(`orphan list lvl1 failed: ${e1.message}`)
    for (const mv of lvl1 ?? []) {
      if (mv.id !== null) {
        out.push({ path: `${u.name}/${mv.name}`, createdAt: mv.created_at ?? null })
        continue
      }
      const { data: lvl2, error: e2 } = await bucket.list(`${u.name}/${mv.name}`, {
        limit: LIST_PAGE_SIZE,
      })
      if (e2) throw new Error(`orphan list lvl2 failed: ${e2.message}`)
      for (const f of lvl2 ?? []) {
        out.push({ path: `${u.name}/${mv.name}/${f.name}`, createdAt: f.created_at ?? null })
      }
    }
  }
  return out
}

async function cleanupOrphans(
  admin: SupabaseClient,
  dryRun: boolean,
): Promise<{ scanned: number; orphans: number; deleted: number; errors: number }> {
  const files = await listAllStorageFiles(admin)

  // DB의 모든 storage_path(soft-delete 포함 — 휴지통 파일은 orphan 아님)
  const known = new Set<string>()
  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await admin
      .from('property_photos')
      .select('storage_path')
      .range(from, from + DB_PAGE_SIZE - 1)
    if (error) throw new Error(`orphan db paths failed: ${error.message}`)
    const batch = (data ?? []) as { storage_path: string }[]
    for (const r of batch) known.add(r.storage_path)
    if (batch.length < DB_PAGE_SIZE) break
  }

  const graceCutoff = Date.now() - ORPHAN_GRACE_HOURS * 3_600_000
  const orphanPaths = files
    .filter((f) => !known.has(f.path))
    .filter((f) => {
      // 방금 업로드분 오삭제 방지: created_at 24h 경과한 것만. created_at 미상이면 보류(삭제 X).
      if (!f.createdAt) return false
      const t = new Date(f.createdAt).getTime()
      return Number.isFinite(t) && t < graceCutoff
    })
    .map((f) => f.path)

  if (dryRun) {
    log({ event: 'cleanup.orphan.dryrun', scanned: files.length, orphans: orphanPaths.length })
    return { scanned: files.length, orphans: orphanPaths.length, deleted: 0, errors: 0 }
  }
  if (orphanPaths.length === 0) {
    return { scanned: files.length, orphans: 0, deleted: 0, errors: 0 }
  }
  const { removed, errors } = await removeStoragePaths(admin, orphanPaths)
  return { scanned: files.length, orphans: orphanPaths.length, deleted: removed, errors }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 호출 토큰 검증 (Supabase Cron이 Vault에 보관한 토큰으로 호출). 미설정 시 항상 거부.
  const expected = Deno.env.get('CLEANUP_TOKEN')
  if (!expected || req.headers.get('Authorization') !== `Bearer ${expected}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const dryRun = Deno.env.get('DRY_RUN') === 'true'
  const startedAt = new Date().toISOString()
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const errors: string[] = []
  let anon = { candidates: 0, deleted: 0, errors: 0 }
  let trash = { count: 0, deleted: 0, errors: 0 }
  let orphan = { scanned: 0, orphans: 0, deleted: 0, errors: 0 }

  // 한 처리가 실패해도 나머지는 진행 (조용한 실패 방지 — errors에 누적)
  try {
    anon = await cleanupAnonymousUsers(admin, dryRun)
  } catch (e) {
    errors.push(`anon: ${e instanceof Error ? e.message : e}`)
  }
  try {
    trash = await cleanupTrash(admin, dryRun)
  } catch (e) {
    errors.push(`trash: ${e instanceof Error ? e.message : e}`)
  }
  try {
    orphan = await cleanupOrphans(admin, dryRun)
  } catch (e) {
    errors.push(`orphan: ${e instanceof Error ? e.message : e}`)
  }

  const summary = {
    event: 'cleanup.run',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
    anonymousCandidates: anon.candidates,
    anonymousUsersDeleted: anon.deleted,
    anonymousErrors: anon.errors,
    trashPhotosDeleted: trash.deleted,
    trashStorageErrors: trash.errors,
    orphansScanned: orphan.scanned,
    orphansDeleted: orphan.deleted,
    orphanErrors: orphan.errors,
    errors,
  }
  log(summary)

  return new Response(JSON.stringify(summary), {
    status: errors.length > 0 ? 207 : 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
