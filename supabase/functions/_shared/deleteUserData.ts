import { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// 사용자 데이터 삭제 코어 (ADR-082)
// delete-account / cleanup / kakao-unlink-webhook이 중복 구현하지 않고 재사용.
// Storage prefix 정리 → chunk retry → 잔여 검증 → auth_provider_links 삭제 → auth.users 삭제(CASCADE).

const BUCKET = 'property-photos'
const LIST_PAGE_SIZE = 1000
const REMOVE_CHUNK_SIZE = 100
const REMOVE_MAX_RETRIES = 3

export type DeleteStage =
  | 'storage-remove'
  | 'storage-verify'
  | 'auth-provider-links'
  | 'delete-user'

/** 삭제 단계별 실패. 호출자(Edge Function)가 stage로 HTTP 응답/로그를 분기. message는 client-safe. */
export class DeleteUserError extends Error {
  readonly stage: DeleteStage
  readonly extra?: Record<string, unknown>
  constructor(stage: DeleteStage, message: string, extra?: Record<string, unknown>) {
    super(message)
    this.name = 'DeleteUserError'
    this.stage = stage
    this.extra = extra
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * 재귀적으로 `{userId}/{moveId}/...` 중첩 파일까지 수집.
 * storage.objects 직접 조회 대신 public Storage API(`list()`)만 사용.
 * 폴더당 1000개 초과 시 offset pagination이 필요할 수 있으나 일반 사용자 규모에서는 발생 가능성 낮음.
 */
export async function listUserStoragePaths(
  admin: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const bucket = admin.storage.from(BUCKET)
  const out: string[] = []
  const { data: lvl1, error: lvl1Err } = await bucket.list(userId, { limit: LIST_PAGE_SIZE })
  if (lvl1Err) throw new Error(`list lvl1 failed: ${lvl1Err.message}`)
  for (const entry of lvl1 ?? []) {
    if (entry.id === null) {
      const { data: lvl2, error: lvl2Err } = await bucket.list(`${userId}/${entry.name}`, {
        limit: LIST_PAGE_SIZE,
      })
      if (lvl2Err) throw new Error(`list lvl2 failed: ${lvl2Err.message}`)
      for (const f of lvl2 ?? []) out.push(`${userId}/${entry.name}/${f.name}`)
    } else {
      out.push(`${userId}/${entry.name}`)
    }
  }
  return out
}

/**
 * 사용자 prefix의 Storage 파일을 chunk 단위 remove + retry 후 잔여 0건 검증.
 * @returns 삭제한 파일 수
 * @throws DeleteUserError('storage-remove' | 'storage-verify')
 */
export async function deleteUserStorage(admin: SupabaseClient, userId: string): Promise<number> {
  const paths = await listUserStoragePaths(admin, userId)

  for (const chunk of chunkArray(paths, REMOVE_CHUNK_SIZE)) {
    let ok = false
    for (let attempt = 1; attempt <= REMOVE_MAX_RETRIES; attempt++) {
      const { error } = await admin.storage.from(BUCKET).remove(chunk)
      if (!error) {
        ok = true
        break
      }
      console.warn(
        `[deleteUserData:storage-remove] userId=${userId} attempt=${attempt} chunk_size=${chunk.length} error=${error.message}`,
      )
      if (attempt < REMOVE_MAX_RETRIES) await sleep(300 * attempt)
    }
    if (!ok) throw new DeleteUserError('storage-remove', 'storage-remove failed')
  }

  // 삭제 후 prefix 재조회 → 잔여 0건 확인 (트리거 우회·부분 실패 방어)
  const remaining = await listUserStoragePaths(admin, userId)
  if (remaining.length > 0) {
    console.error(`[deleteUserData:storage-verify] userId=${userId} remaining=${remaining.length}`)
    throw new DeleteUserError('storage-verify', 'storage residue', { remaining: remaining.length })
  }

  return paths.length
}

/**
 * public.* 중 CASCADE로 정리되지 않는 행을 명시 삭제.
 * auth_provider_links는 public.users FK(ON DELETE CASCADE)지만 deleteUser 전에 명시 삭제해
 * partial cleanup 가시성을 확보(여기서 실패하면 deleteUser를 진행하지 않음).
 * @throws DeleteUserError('auth-provider-links')
 */
export async function deleteUserDatabaseRows(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.from('auth_provider_links').delete().eq('user_id', userId)
  if (error) {
    console.error(`[deleteUserData:auth-provider-links] userId=${userId} ${error.message}`)
    throw new DeleteUserError('auth-provider-links', 'links cleanup failed')
  }
}

/**
 * 사용자 완전 삭제: Storage → auth_provider_links → auth.users(public.* CASCADE).
 * delete-account / cleanup / kakao-unlink-webhook 공용.
 * @throws DeleteUserError (stage로 실패 지점 식별)
 */
export async function deleteUserCompletely(
  admin: SupabaseClient,
  userId: string,
): Promise<{ removedPaths: number }> {
  const removedPaths = await deleteUserStorage(admin, userId)
  await deleteUserDatabaseRows(admin, userId)

  // CASCADE: auth.users 삭제 시 public.users → moves/user_checklist_items/property_photos 자동
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    console.error(`[deleteUserData:delete-user] userId=${userId} ${error.message}`)
    throw new DeleteUserError('delete-user', 'delete-user failed')
  }

  return { removedPaths }
}
