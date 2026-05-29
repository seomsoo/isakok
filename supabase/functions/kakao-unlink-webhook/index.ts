import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { log } from '../_shared/logger.ts'
import { deleteUserCompletely, DeleteUserError } from '../_shared/deleteUserData.ts'

// Kakao 연결 끊기 웹훅 (ADR-078, 역방향). GET/POST 모두 지원(파라미터=쿼리 또는 form body), 3초 내 200 OK 요구.
// 위조 방어(다단계):
//   (0) Authorization 헤더 검증 — Kakao는 콜백에 `Authorization: KakaoAK ${SERVICE_APP_ADMIN_KEY}` 를 실어 보낸다.
//       Admin Key는 비밀값이므로, 이를 모르는 위조 요청은 여기서 차단된다(핵심 방어).
//   (1) app_id 검증.
//   (2) Admin Key로 실제 연결 끊김 재조회(defense-in-depth) — 끊김이 확정되지 않으면 삭제하지 않고 보류.
// 배포: verify_jwt=false (Kakao는 Supabase JWT가 아닌 KakaoAK를 보내므로 플랫폼 JWT 검증을 꺼야 헤더가 전달됨).

const KAKAO_USER_INFO_API = 'https://kapi.kakao.com/v2/user/me'

/** GET(쿼리스트링)·POST(form body) 모두에서 콜백 파라미터를 읽는다. */
async function readCallbackParams(req: Request, url: URL): Promise<URLSearchParams> {
  if (req.method !== 'GET') {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
      try {
        return new URLSearchParams(await req.text())
      } catch {
        return url.searchParams
      }
    }
  }
  return url.searchParams
}

function ok(body: Record<string, unknown> = {}): Response {
  // Kakao는 3초 내 200만 기대 → 처리 결과와 무관하게 200(재시도 폭주 방지). 실패는 로그로 가시화.
  return new Response(JSON.stringify({ ok: true, ...body }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Kakao Admin Key로 연결 상태 재조회 (/v2/user/me + target_id, GET/POST 모두 가능 — 여기선 POST form).
 * @returns true=연결 끊김 확정 / false=아직 연결됨 / null=확정 불가(보류)
 *
 * 대상 혼동 방지: res.ok면 반환된 `id`가 조회 대상 user_id와 일치할 때만 "연결됨(false)"으로 확정한다.
 * id가 없거나 불일치하면 null(보류)로 둬, target_id가 무시되는 비정상 응답에서 타인 삭제로 이어지지 않게 한다.
 * 응답 해석이 불확실하면 항상 null(보류) = 안전 측. 정확한 규격은 운영 배포 전 Kakao Developers 문서로 재확인.
 */
async function confirmKakaoUnlinked(
  adminKey: string,
  kakaoUserId: string,
): Promise<boolean | null> {
  try {
    const res = await fetch(KAKAO_USER_INFO_API, {
      method: 'POST',
      headers: {
        Authorization: `KakaoAK ${adminKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ target_id_type: 'user_id', target_id: kakaoUserId }).toString(),
    })
    const json = (await res.json().catch(() => ({}))) as { id?: number; code?: number }
    if (res.ok) {
      // 조회 대상 id가 echo로 일치 = 아직 연결됨 → 보류. 불일치/누락이면 확정 불가(null) → 보류.
      if (typeof json.id === 'number' && String(json.id) === kakaoUserId) return false
      return null
    }
    if (json.code === -101) return true // 미등록(연결 끊김) 확정
    return null // 그 외 에러 = 확정 불가 → 보류
  } catch {
    return null
  }
}

serve(async (req) => {
  const url = new URL(req.url)
  const referrerType = url.searchParams.get('referrer_type')

  const expectedAppId = Deno.env.get('KAKAO_APP_ID')
  const adminKey = Deno.env.get('KAKAO_ADMIN_KEY')

  // (0) Authorization 헤더 검증 — 위조 방어 핵심. Kakao는 `Authorization: KakaoAK ${ADMIN_KEY}` 를 보낸다.
  // adminKey 미설정(운영 시크릿 미등록) 시 검증 불가 → 전부 보류(삭제 안 함, fail-safe).
  if (!adminKey || req.headers.get('Authorization') !== `KakaoAK ${adminKey}`) {
    log({ event: 'kakao.unlink.skip', reason: 'auth', referrerType })
    return ok({ skipped: 'auth' })
  }

  // 파라미터는 GET 쿼리 또는 POST form body
  const params = await readCallbackParams(req, url)
  const appId = params.get('app_id')
  const kakaoUserId = params.get('user_id')

  // (1) app_id 검증
  if (!expectedAppId || appId !== expectedAppId) {
    log({ event: 'kakao.unlink.skip', reason: 'app_id_mismatch', referrerType })
    return ok({ skipped: 'app_id' })
  }
  if (!kakaoUserId) {
    log({ event: 'kakao.unlink.skip', reason: 'missing_param' })
    return ok({ skipped: 'param' })
  }

  // (2) Admin Key 재조회 — defense-in-depth. 끊김 확정 아니면 보류(삭제 금지).
  const unlinked = await confirmKakaoUnlinked(adminKey, kakaoUserId)
  if (unlinked !== true) {
    log({ event: 'kakao.unlink.hold', kakaoUserId, confirmed: unlinked })
    return ok({ held: true })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // kakao user_id(회원번호) → 우리 user_id 매핑
  const { data: linkRow } = await admin
    .from('auth_provider_links')
    .select('user_id')
    .eq('provider', 'kakao')
    .eq('provider_user_id', kakaoUserId)
    .maybeSingle()

  // idempotency: 이미 삭제/매핑 없음 → 200 OK
  if (!linkRow) {
    log({ event: 'kakao.unlink.noop', kakaoUserId })
    return ok({ noop: true })
  }
  const ourUserId = linkRow.user_id as string

  // provider count 분기: 다른 provider(native google/apple identity 또는 비-kakao link)가 있으면 user 보존
  const { data: userResp } = await admin.auth.admin.getUserById(ourUserId)
  const identities = userResp.user?.identities ?? []
  const hasNativeSocial = identities.some(
    (id) => id.provider === 'google' || id.provider === 'apple',
  )
  const { data: otherLinks } = await admin
    .from('auth_provider_links')
    .select('provider')
    .eq('user_id', ourUserId)
    .neq('provider', 'kakao')
  const hasOtherProvider = hasNativeSocial || (otherLinks ?? []).length > 0

  try {
    if (hasOtherProvider) {
      // 다른 provider 있음 → kakao 매핑만 제거, user 보존
      const { error } = await admin
        .from('auth_provider_links')
        .delete()
        .eq('user_id', ourUserId)
        .eq('provider', 'kakao')
      if (error) throw new Error(error.message)
      log({ event: 'kakao.unlink.mapping_removed', userId: ourUserId })
      return ok({ action: 'mapping_removed' })
    }

    // kakao만 → 완전 삭제 (삭제 코어 재사용, ADR-082)
    await deleteUserCompletely(admin, ourUserId)
    log({ event: 'kakao.unlink.deleted', userId: ourUserId })
    return ok({ action: 'deleted' })
  } catch (err) {
    const stage = err instanceof DeleteUserError ? err.stage : 'unknown'
    log({ event: 'kakao.unlink.error', userId: ourUserId, stage })
    // 실패해도 200(Kakao 재시도 폭주 방지). 로그로 가시화 → 수동/cleanup 후속.
    return ok({ error: true, stage })
  }
})
