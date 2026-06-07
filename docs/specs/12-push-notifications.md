# 12단계: 푸시 알림 (일정 기반 리마인더) 스펙 (SDD) v2

> 목표: 이사 일정 기반 리마인더를 푸시로 발송해, 유저가 "오늘 챙길 일"을 놓치지 않고 앱으로 다시 돌아오게 한다 (리텐션).
> 이 단계가 끝나면: 회원·익명 유저가 권한을 수락하면, 매일 오전 9시(KST) 데일리 다이제스트 + D-day 마일스톤 알림이 발송되고, 알림 탭 시 해당 화면으로 진입하며, 설정에서 켜고 끌 수 있는 상태.

> 재사용 자산: 브릿지(ADR-047) · Supabase Cron + Edge Function + Vault(ADR-076) · Edge Function JWT 검증 패턴(10-2 §4-1) · WEB_READY lazy-mount(ADR-049) · cascade 정리(ADR-082).

> **v1 → v2 변경 (GPT 리뷰 반영)**
>
> - `send-notifications`는 `verify_jwt=false` + 내부 토큰 검증 (cleanup 패턴 답습). [리뷰 #1]
> - `push_tokens` 직접 upsert 폐기 → **`register-push-token` Edge Function(service_role)** 등록. service_role only. (본인 RLS + onConflict가 토큰 재할당 시 RLS에 막힘) [리뷰 #2]
> - `users.push_enabled`는 직접 UPDATE 불가(10-2에서 users UPDATE 차단) → **`set_push_enabled` RPC**. [리뷰 #3]
> - `push_enabled` 기본값 **false** (권한 granted + 토큰 등록 성공 시 true). [리뷰 #4]
> - `notification_log` claim 모델 (**claimed/sent/failed**) — 발송 전 insert만 하면 실패가 영구 skip. [리뷰 #5]
> - milestone 멱등에 **milestone_date** 포함 — 이사일 변경 시 새 D-day 재발송. [리뷰 #6]
> - **current active move 1개 기준** 발송 (useCurrentMove 기준). [리뷰 #7]
> - KST today를 **DB 기준**(`(now() AT TIME ZONE 'Asia/Seoul')::date`)으로 고정. [리뷰 #8]
> - DeviceNotRegistered 정리는 **ticket-level만**(receipt polling 후속) — 표현 정확화. [리뷰 #9]
> - NAVIGATE path **allowlist** 검증. [리뷰 #10]
> - soft-ask 1회 가드를 **`users.push_prompt_seen_at`** persistent로. [리뷰 #11]
> - registerPush projectId fallback / hasToken=등록성공 / effective status 표 / 병합 로그 순서 / 토큰단위 발송 / 처리 상한 / iOS 권한문구·App Privacy 표현. [리뷰 #12~19]

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- 전송 인프라: **Expo Push Notification Service**(EPNS)
- 알림 2종: **데일리 다이제스트** + **D-day 마일스톤**(D-7/3/1/0), 같은 일일 Cron에서 평가, **current active move 1개 기준**
- 권한 UX: **soft-ask(온보딩 직후 모달 1회, persistent 가드) → hard-ask(네이티브 OS 권한)**, 설정에서 재개
- DB: `push_tokens`(service_role only), `notification_log`(claim 모델), `users.push_enabled`(기본 false)·`push_prompt_seen_at`
- RPC: `set_push_enabled(boolean)`, `set_push_prompt_seen()` (users UPDATE 차단 우회)
- Edge Function: `register-push-token`(JWT 검증 + service_role upsert), `send-notifications`(verify_jwt=false + 내부 토큰 검증)
- 네이티브: `expo-notifications` 권한/토큰 발급/Android 채널/포그라운드 핸들러/응답 리스너/콜드스타트
- 브릿지 확장: `REQUEST_PUSH_PERMISSION`, `REQUEST_PUSH_STATUS`(web→native), `PUSH_STATUS`, `NAVIGATE`(native→web)
- 발송: Supabase Cron(09:00 KST, **DB 기준 KST today**) + Vault 토큰. 멱등: claim INSERT ON CONFLICT, 무효 토큰(ticket-level) 삭제, **DRY_RUN 우선**
- 딥링크: 페이로드 `data.route`(기본 대시보드, **allowlist**), 콜드스타트 WEB_READY 패턴 재사용
- 설정: 전체 1토글 + OS권한/앱토글 2레이어 + effective status
- 카피: 권한 모달 / 푸시 문구 / 설정 라벨 (친근+깔끔 톤)
- manual-setup: EAS APNs 키 + FCM 자격증명, Vault `PUSH_CRON_TOKEN`, DRY_RUN secret
- 개인정보/약관: Expo(EAS, US) 처리위탁·국외이전 + "기기 푸시 토큰" 수집 고지

### 안 하는 것

- 항목별 마감 / 휴면 복귀 / 계약 만료일 알림 (v1.1 — route·notification_log 구조가 수용)
- 종류별 알림 토글 / 다중 active move 동시 알림
- 유저별 발송 시각·타임존 저장 (전 유저 KST)
- 마케팅/프로모션 푸시
- 인앱 알림 인박스 / 히스토리 화면
- **Expo receipt polling**(DeviceNotRegistered 정밀 정리) — 후속
- notification_log 자동 재시도 (failed 기록만, 수동 재시도 후속)
- 분산 발송(워커 분할) — 처리 상한 초과 시 후속
- token-level delivery 성공/실패 기록 — 후속

---

## 1. 폴더 구조

```
supabase/
├── config.toml                            ← 수정 ([functions.send-notifications] verify_jwt=false)
├── migrations/
│   ├── 000NN_push_tokens.sql              ← 생성 (service_role only)
│   ├── 000NN_notification_log.sql         ← 생성 (claim 모델)
│   ├── 000NN_users_push_columns.sql       ← 생성 (push_enabled default false + push_prompt_seen_at)
│   └── 000NN_push_rpcs.sql                ← 생성 (set_push_enabled / set_push_prompt_seen)
└── functions/
    ├── register-push-token/
    │   └── index.ts                       ← 생성 (JWT 검증 + service_role upsert)
    └── send-notifications/
        ├── index.ts                       ← 생성 (verify_jwt=false, 내부 토큰 검증)
        ├── expoPush.ts                     ← 생성 (Expo Push REST + 청크/ticket 처리)
        ├── buildMessage.ts                 ← 생성 (조건 평가 + 메시지 합성)
        ├── kstDate.ts                      ← 생성 (DB 기준 KST today)
        └── copy.ts                         ← 생성 (푸시 문구 상수)

packages/shared/src/
├── types/bridge.ts                        ← 수정 (푸시 메시지 타입)
└── constants/
    ├── pushCopy.ts                        ← 생성 (모달/설정 카피)
    └── pushRoutes.ts                      ← 생성 (NAVIGATE allowlist)

apps/mobile/src/
├── push/
│   ├── registerPush.ts                    ← 생성 (권한 + 토큰 발급 + register-push-token 호출)
│   ├── pushStatus.ts                      ← 생성 (권한/토큰 상태)
│   ├── notificationHandler.ts             ← 생성 (포그라운드/응답/콜드스타트)
│   └── channels.ts                        ← 생성 (Android 채널)
├── components/WebViewScreen.tsx           ← 수정 (REQUEST_PUSH_* 라우팅, NAVIGATE flush)
├── auth/broadcast.ts                      ← 수정 (PUSH_STATUS / NAVIGATE)
└── app/_layout.tsx                        ← 수정 (핸들러/리스너 초기화)

apps/web/src/
├── features/
│   ├── onboarding/components/PushPermissionSheet.tsx   ← 생성 (soft-ask, push_prompt_seen_at 가드)
│   └── settings/
│       ├── components/PushSettingRow.tsx               ← 생성 (토글 + effective status)
│       └── hooks/usePushSettings.ts                    ← 생성 (set_push_enabled RPC, PUSH_STATUS 수신)
├── push/pushBridge.ts                     ← 생성 (REQUEST_PUSH_* / PUSH_STATUS / NAVIGATE)
└── App.tsx                                ← 수정 (NAVIGATE → normalizePushRoute → router)
```

---

## 2. 패키지 설치

```bash
npx expo install expo-notifications expo-device expo-constants
# Edge Function은 외부 의존 없이 Deno fetch로 Expo Push REST 호출
```

> `expo-device`: 실기기 가드(`Device.isDevice`). `expo-constants`: EAS projectId 조회.

---

## 3. DB 마이그레이션

### 3-1. push_tokens (service_role only)

```sql
-- 000NN_push_tokens.sql
CREATE TABLE public.push_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,                 -- ExpoPushToken
  platform     text NOT NULL CHECK (platform IN ('ios','android')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_tokens_user_id ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = anon/authenticated 직접 접근 전면 차단. 등록은 register-push-token(service_role)만.
```

> **왜 service_role only (v1의 본인 RLS에서 변경)**: 본인 RLS를 검토했으나, 같은 ExpoPushToken이 user A에 붙은 상태에서 user B가 `upsert(onConflict:token)`하면 `ON CONFLICT DO UPDATE`가 A의 row를 갱신해야 하는데 `USING(auth.uid()=user_id)`가 그 row를 막아 **재할당이 실패**(계정삭제→새 익명, 재설치/복원, 기기 양도 시 발생). → 토큰 등록을 `register-push-token` Edge Function(§7-1, JWT 검증 후 service_role upsert)로 옮기고 테이블은 service_role only. 토큰 값이 웹/WebView를 거치지 않는 원래 의도와도 부합.
> **`on delete cascade`**: 익명 cleanup(ADR-076)·계정삭제(ADR-082)가 user 삭제 시 토큰 자동 정리.

### 3-2. notification_log (claim 모델 + 멱등)

```sql
-- 000NN_notification_log.sql
CREATE TABLE public.notification_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  move_id       uuid REFERENCES public.moves(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('digest','milestone')),
  milestone_day  integer,                            -- 7|3|1|0, digest는 NULL
  milestone_date date,                               -- 마일스톤이 발생한 KST 날짜 (digest는 NULL)
  sent_date     date NOT NULL,                       -- KST 발송 시도일
  status        text NOT NULL DEFAULT 'claimed'
                  CHECK (status IN ('claimed','sent','failed')),
  sent_at       timestamptz,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
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
```

> **왜 claim 모델 (v1에서 변경)**: v1처럼 "발송 전 insert → ON CONFLICT면 skip"만 하면, insert 성공 후 Expo 전송이 실패해도 다음 Cron이 conflict로 "이미 발송"으로 보고 **영구 skip**. → `status='claimed'`로 선점(claim) → 전송 → 성공 `sent` / 실패 `failed` 갱신. claim 0 rows(이미 claimed/sent)면 skip. 실패 가시성 + 멱등 동시 확보. **재시도는 MVP에서 안 함**(failed 기록만, 수동 재시도 후속).
> **왜 milestone_date (v1에서 변경)**: `(move_id, milestone_day)`만으론 이사일 변경 시 새 D-7이 막힘(6/20→D-7 발송 후 이사일 7/10 변경 시 새 D-7 7/3이 (move_id,7) 충돌). 이사일 변경은 이 앱 1급 기능(update_move_with_reschedule)이라 `milestone_date`까지 포함해 날짜가 바뀌면 새 알림 허용.

### 3-3. users 컬럼

```sql
-- 000NN_users_push_columns.sql
ALTER TABLE public.users
  ADD COLUMN push_enabled boolean NOT NULL DEFAULT false,   -- 권한 granted + 토큰 등록 성공 시 true
  ADD COLUMN push_prompt_seen_at timestamptz;               -- soft-ask 1회 가드 (persistent)
```

> **왜 기본 false (v1의 true에서 변경)**: `push_enabled=true`는 "앱 토글 켜짐"을 뜻하는데, 권한 요청 전/“나중에” 유저가 true면 effective status(§6-2)가 헷갈림. 명시적으로 켰을 때만 true가 상태를 정확히 반영. 발송 조건은 `push_enabled=true AND 토큰 존재`로 동일.
> 익명도 `auth.users→public.users` 트리거(00013)로 행 존재 → 그대로 적용.

### 3-4. RPC (users UPDATE 차단 우회)

```sql
-- 000NN_push_rpcs.sql
-- public.users는 10-2에서 UPDATE 전면 차단(provider/email 위조 방지). 컬럼 화이트리스트 RPC로만 변경.
CREATE OR REPLACE FUNCTION public.set_push_enabled(p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users SET push_enabled = p_enabled, updated_at = now() WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_push_enabled(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_push_enabled(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_push_prompt_seen()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users SET push_prompt_seen_at = now(), updated_at = now()
  WHERE id = auth.uid() AND push_prompt_seen_at IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.set_push_prompt_seen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_push_prompt_seen() TO authenticated;
```

> 10-2의 `update_move_with_reschedule` 등과 동일한 DEFINER + `auth.uid()` 본인 검증 + `SET search_path` 패턴. users 보안성 컬럼을 열지 않으면서 화이트리스트 컬럼만 변경.

---

## 4. 브릿지 확장 (`packages/shared/src/types/bridge.ts`)

```typescript
export type WebToNativeMessage =
  // ...기존...
  | { type: 'REQUEST_PUSH_PERMISSION' } // soft-ask "받기" → 네이티브 hard-ask + 토큰 등록
  | { type: 'REQUEST_PUSH_STATUS' } // 설정 진입 시 상태 조회

export type NativeToWebMessage =
  // ...기존...
  | {
      type: 'PUSH_STATUS'
      payload: { permission: 'granted' | 'denied' | 'undetermined'; hasToken: boolean }
    }
  | { type: 'NAVIGATE'; payload: { path: string } }
```

> `hasToken`은 **OS 권한이 아니라 register-push-token 서버 등록 성공 여부**(§5-1, 리뷰 #13). 토큰 값 자체는 웹에 안 보냄.

---

## 5. 네이티브 (expo-notifications)

### 5-1. 권한 + 토큰 발급 + 서버 등록 (`registerPush.ts`)

흐름: `REQUEST_PUSH_PERMISSION` → OS 권한 → 허용 시 `getExpoPushTokenAsync` → **`register-push-token` Edge Function 호출**(네이티브 세션 JWT) → 성공 시 `set_push_enabled(true)` → `PUSH_STATUS` 회신.

```typescript
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabaseNative } from '../auth/supabaseNative'

export async function registerPush(): Promise<{
  permission: 'granted' | 'denied' | 'undetermined'
  hasToken: boolean
}> {
  if (!Device.isDevice) return { permission: 'undetermined', hasToken: false }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let status = existing
  if (existing !== 'granted') status = (await Notifications.requestPermissionsAsync()).status
  if (status !== 'granted') return { permission: status, hasToken: false }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) {
    console.error('[registerPush] EAS projectId missing')
    return { permission: 'granted', hasToken: false }
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  const platform = Platform.OS === 'ios' ? 'ios' : 'android'

  // register-push-token Edge Function (JWT 검증 + service_role upsert). functions.invoke가 Authorization 자동 주입.
  const { error } = await supabaseNative.functions.invoke('register-push-token', {
    body: { token, platform },
  })
  if (error) {
    console.error('[registerPush] server register failed', error)
    return { permission: 'granted', hasToken: false } // hasToken=등록 성공 여부 (리뷰 #13)
  }
  // 등록 성공 → 앱 토글 ON
  await supabaseNative.rpc('set_push_enabled', { p_enabled: true })
  return { permission: 'granted', hasToken: true }
}
```

> **왜 직접 upsert가 아니라 Edge Function?**: §3-1 RLS 충돌(토큰 재할당) 회피. `register-push-token`이 JWT로 현재 user 확인 후 service_role로 `onConflict:token` upsert → 다른 user에 붙은 토큰도 안전하게 재할당.

### 5-2. Android 채널 (`channels.ts`)

```typescript
export async function ensureChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('default', {
    name: '이사 알림',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  })
}
```

### 5-3. 포그라운드/응답/콜드스타트 (`notificationHandler.ts`)

```typescript
import * as Notifications from 'expo-notifications'
import { broadcastToWebViews } from '../auth/broadcast'
import { normalizePushRoute } from '@moving/shared/constants/pushRoutes'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

let pendingRoute: string | null = null

export function attachResponseListener() {
  const sub = Notifications.addNotificationResponseReceivedListener((res) => {
    const route = normalizePushRoute(res.notification.request.content.data?.route)
    pendingRoute = route
    flushPendingRoute()
  })
  return () => sub.remove()
}

export async function handleColdStart() {
  const last = await Notifications.getLastNotificationResponseAsync()
  if (last) pendingRoute = normalizePushRoute(last.notification.request.content.data?.route)
}

export function flushPendingRoute() {
  if (pendingRoute) {
    broadcastToWebViews({ type: 'NAVIGATE', payload: { path: pendingRoute } })
    pendingRoute = null
  }
}
```

> **콜드스타트**: 종료 상태 탭 → WebView 로드 전이라 즉시 NAVIGATE 유실 → AUTH_SESSION lazy-mount(ADR-049)와 동일하게 `pendingRoute` 보류 → `WEB_READY` 후 flush.
> **route는 네이티브에서도 normalize**(allowlist) — 1차 방어.

### 5-4. WebViewScreen 라우팅

```typescript
case 'REQUEST_PUSH_PERMISSION': {
  broadcastToWebViews({ type: 'PUSH_STATUS', payload: await registerPush() })
  return
}
case 'REQUEST_PUSH_STATUS': {
  broadcastToWebViews({ type: 'PUSH_STATUS', payload: await getPushStatus() })
  return
}
case 'WEB_READY': {
  hideSplashOnce()
  const session = getCurrentSession()
  if (session && webViewRef.current) sendSessionToWebView(webViewRef.current, session)
  flushPendingRoute()   // 푸시 보류 라우트 flush
  return
}
```

---

## 6. 웹 (soft-ask / 설정 / 딥링크)

### 6-1. soft-ask 모달 (`PushPermissionSheet.tsx`)

- **노출 조건** (전부 만족): `push_prompt_seen_at IS NULL` AND `push_enabled = false` AND `isNativeWebView()` AND 온보딩 완료 직후.
- "받기" → `REQUEST_PUSH_PERMISSION` + `set_push_prompt_seen()`. "나중에" → `set_push_prompt_seen()`만(OS 다이얼로그 안 띄움 → 거부 박제 회피).
- persistent 가드라 앱 재시작/WebView reload에도 재노출 없음(리뷰 #11).

### 6-2. 설정 토글 + effective status (`PushSettingRow.tsx` / `usePushSettings.ts`)

상태는 3값 조합 (리뷰 #14):

```
effectivePushEnabled = permission === 'granted' && push_enabled === true && hasToken === true
```

| permission   | push_enabled | hasToken | UI                                                                             |
| ------------ | ------------ | -------- | ------------------------------------------------------------------------------ |
| denied       | —            | —        | 토글 ON 불가 · "기기 알림이 꺼져 있어요 · 설정에서 켜기"(Linking.openSettings) |
| undetermined | —            | —        | 토글 ON 시 권한 요청 시작                                                      |
| granted      | false        | —        | 앱 내 알림 꺼짐 (토글 OFF)                                                     |
| granted      | true         | false    | "토큰 등록 중/재시도"                                                          |
| granted      | true         | true     | 알림 켜짐                                                                      |

- 토글 ON → `REQUEST_PUSH_PERMISSION`(권한·토큰·`set_push_enabled(true)` 일괄). OFF → `set_push_enabled(false)` RPC.
- 진입 시 `REQUEST_PUSH_STATUS` → `PUSH_STATUS` 수신.

### 6-3. 딥링크 수신 (`App.tsx` / `pushBridge.ts`)

```typescript
if (msg.type === 'NAVIGATE') router.navigate(normalizePushRoute(msg.payload.path))
if (msg.type === 'PUSH_STATUS') {
  /* usePushSettings 갱신 */
}
```

`pushRoutes.ts` (양측 공용):

```typescript
const ALLOWED = ['/dashboard', '/timeline', '/photos', '/settings']
export function normalizePushRoute(route: unknown): string {
  if (typeof route !== 'string' || !route.startsWith('/')) return '/dashboard'
  return ALLOWED.some((p) => route === p || route.startsWith(`${p}/`)) ? route : '/dashboard'
}
```

> 외부 URL·`javascript:`·미허용 route는 `/dashboard` fallback (리뷰 #10).

---

## 7. Edge Functions

### 7-1. register-push-token (JWT 검증 + service_role upsert)

```toml
# config.toml — 유저 호출 함수라 JWT 검증 유지 (익명 JWT도 통과)
[functions.register-push-token]
verify_jwt = true
```

```typescript
// 10-2 §4-1 generate-ai-guide와 동일: anon client + auth.getUser()로 검증 (직접 decode 금지)
const authHeader = req.headers.get('Authorization')
if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } },
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: u, error: ue } = await userClient.auth.getUser()
if (ue || !u.user) return json({ error: 'unauthorized' }, 401)

const { token, platform } = await req.json()
if (!isExpoPushToken(token)) return json({ error: 'invalid token' }, 400)
if (!['ios', 'android'].includes(platform)) return json({ error: 'invalid platform' }, 400)

await admin.from('push_tokens').upsert(
  { user_id: u.user.id, token, platform, last_seen_at: now, updated_at: now },
  { onConflict: 'token' }, // service_role이라 다른 user에 붙은 토큰도 재할당 가능
)
return json({ ok: true }, 200)
```

> `isExpoPushToken`: `ExponentPushToken[...]` / `ExpoPushToken[...]` 형식 검증.

### 7-2. send-notifications (Cron 전용)

```toml
# config.toml — Cron 전용 서버-서버 함수. Supabase JWT가 아니라 PUSH_CRON_TOKEN을 내부 검증.
[functions.send-notifications]
verify_jwt = false
```

```typescript
// 1) 내부 토큰 검증 (cleanup 패턴 답습)
const auth = req.headers.get('Authorization') ?? ''
const expected = Deno.env.get('PUSH_CRON_TOKEN')
if (!expected || auth !== `Bearer ${expected}`) return json({ error: 'unauthorized' }, 401)

// 2) KST today (DB 기준 — Deno new Date()는 UTC라 사용 금지)
//    select (now() AT TIME ZONE 'Asia/Seoul')::date
const kstToday = await getKstToday(admin) // kstDate.ts
```

처리 로직:

```
3. 대상: users.push_enabled=true AND push_tokens 존재 (DRY_RUN이면 전송/INSERT 생략)
4. 유저별 current active move 1개 선택 (useCurrentMove 기준: deleted_at IS NULL,
   moving_date 가장 가까운 미래 우선, 없으면 가장 최근 updated_at). 여러 active move 동시 알림은 v1.1.
5. dDay = move.moving_date - kstToday
   pending = count(user_checklist_items where move_id=? and is_completed=false and assigned_date <= kstToday)
6. 조건 (kind별 claim):
   isMilestone = dDay ∈ {7,3,1,0}
   - milestone: INSERT(kind=milestone, milestone_day=dDay, milestone_date=move.moving_date - dDay일=kstToday,
                       sent_date=kstToday, status='claimed') ON CONFLICT DO NOTHING
   - digest:    pending>0 이면 INSERT(kind=digest, sent_date=kstToday, status='claimed') ON CONFLICT DO NOTHING
   병합 규칙(리뷰 #15): milestone claim과 digest claim 중 하나라도 0 rows(이미 발송)면
                       그날 그 유저의 병합 알림은 skip(중복 피로 방지). 둘 다 신규 claim일 때만 1건 병합 전송.
   - milestone만 신규: 마일스톤 단독 (pending>0이면 본문에 할 일 수 병합)
   - digest만 신규:    다이제스트
7. 메시지 합성(§9) → Expo Push 청크(100) 전송
8. 결과: 전송 성공(ticket accepted) → 해당 log status='sent', sent_at=now
        전송 실패 → status='failed', error 기록 (자동 재시도 X)
        ticket-level error가 DeviceNotRegistered/잘못된 토큰 → 그 토큰 push_tokens 삭제
9. 처리 상한(리뷰 #17): 1회 최대 ~500 users / ~1000 tokens. 초과 시 structured log truncated=true (분산은 후속).
10. structured log: kstToday, 대상수, claimed/sent/failed, 삭제토큰수, truncated, DRY_RUN.
```

### 7-3. Expo Push (`expoPush.ts`)

```typescript
export async function sendExpoPush(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const tickets: ExpoTicket[] = []
  for (const c of chunk(messages, 100)) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      body: JSON.stringify(c),
    })
    tickets.push(...((await res.json()).data ?? []))
  }
  return tickets
}
type ExpoMessage = {
  to: string
  title: string
  body: string
  data: { route: string }
  channelId?: 'default'
}
```

> **DeviceNotRegistered 정리 범위 (리뷰 #9)**: 12단계는 **send 응답(ticket)의 즉시 error만** 처리(잘못된 토큰/DeviceNotRegistered ticket-level). APNs/FCM 최종 전달 오류의 정밀 정리는 **receipt polling 후속**. 문서에서 "무효 토큰 자동 삭제"를 완료 보장으로 쓰지 않는다("ticket-level 오류 토큰 정리").

---

## 8. Supabase Cron

```sql
-- 매일 00:00 UTC = 09:00 KST (서머타임 없음). ADR-076 패턴.
select cron.schedule('send-notifications-daily', '0 0 * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='PUSH_CRON_TOKEN')
    ),
    body := '{}'::jsonb
  );
$$);
```

> Vault `PUSH_CRON_TOKEN`은 `send-notifications` 내부 검증값과 동일. cleanup의 `cleanup_token` 패턴 답습.

---

## 9. 카피 (친근+깔끔 톤)

> 톤: 짧게 · 구어체 존댓말 · 이득 중심 · 제안형. 권한 모달 "스팸 없음+빈도 명시", 다이제스트 본문 첫 항목 노출, 이모지는 D-day에만 1개.

| 지점           | 제목                             | 본문/버튼                                                                                           |
| -------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| 권한 모달      | 이사, 깜빡하지 않게 챙겨드릴게요 | 할 일 있는 날 아침에 딱 한 번, 필요한 것만 알려드려요. 광고·스팸은 없어요. · [알림 받기] / [나중에] |
| 다이제스트 N≥2 | 오늘 챙길 일 {N}개               | '{첫 항목}' 외 {N-1}건 · 지금 확인하기                                                              |
| 다이제스트 N=1 | 오늘 챙길 일 1개                 | '{첫 항목}' 잊지 마세요                                                                             |
| D-7            | 이사까지 일주일 남았어요 🚚      | 지금부터 하나씩 챙기면 여유로워요                                                                   |
| D-3            | 이사 D-3, 막바지예요             | 오늘 할 일 {N}개 확인하기                                                                           |
| D-1            | 내일이 이사날이에요              | 마지막 점검, 빠진 거 없는지 확인해요                                                                |
| D-day          | 오늘 이사 가는 날! 🎉            | 고생 많으셨어요. 마지막 체크리스트만 확인해요                                                       |
| 병합           | 이사 D-{n} · 오늘 챙길 일 {N}개  | '{첫 항목}' 외 {N-1}건 확인하기                                                                     |
| 설정 토글      | 할 일 알림                       | 할 일 있는 날 아침에 알려드려요                                                                     |
| OS 권한 꺼짐   | 기기 알림이 꺼져 있어요          | [설정에서 켜기]                                                                                     |

> 푸시 문구 → `functions/send-notifications/copy.ts`, 모달·설정 → `packages/shared/src/constants/pushCopy.ts`. 첫 항목 정렬 critical→warning→sort_order.

---

## 10. manual-setup (콘솔 — 코드 아님)

- **EAS APNs 키(iOS)**: APNs Auth Key(.p8) 생성 → `eas credentials` 등록.
- **EAS FCM 자격증명(Android)**: Firebase + `google-services.json` + FCM V1 서비스 계정 키 → `eas credentials` 등록.
- **Vault**: `PUSH_CRON_TOKEN` 생성(Cron→send-notifications 인증). cleanup의 `cleanup_token`과 동일 방식.
- **Edge secret**: `PUSH_DRY_RUN`(초기 true), `PUSH_CRON_TOKEN`(검증용).
- **app.json**: `expo.extra.eas.projectId` 확인, Android 알림 아이콘/채널, **iOS 알림 권한은 OS 기본 prompt 중심**(별도 infoPlist 문구 불필요 — 카메라/위치와 다름. 커스텀 설명은 soft-ask 모달이 담당, 리뷰 #18).

> "Expo Push면 키 관리 불필요"는 오해 — 전송 코드만 단일 API. APNs/FCM 자격증명 등록은 EAS에 1회 필요.

---

## 11. 개인정보 / 약관

- 처리위탁/국외이전에 **Expo(Expo/EAS, 미국)** 추가 — 이전 항목(기기 푸시 토큰)·국가·보유기간 명시.
- 수집항목에 **"기기 푸시 토큰"** 추가.
- App Privacy / Data Safety: **"Push token / Device identifier" 관련 항목을 콘솔 질문 기준으로 보수적으로 선택**(푸시 토큰은 기기 알림 주소로, 일반 device ID와 분류가 다를 수 있음, 리뷰 #19). IDFA/광고 추적 미사용 → **Tracking=None 유지**.
- `/privacy` 반영.

---

## 12. ADR (DECISIONS.md 복붙용)

### ADR-090: 푸시 전송 인프라 = Expo Push Notification Service

- 결정: Edge Function이 Expo Push REST에 `ExpoPushToken+메시지` POST. Expo가 APNs/FCM 분배.
- 이유: 1인 운영 부담 최소화, 토큰 하나로 양 플랫폼 통합, `expo-notifications` 통합, 무료. 규모 시 토큰 매핑만 교체해 직접 전환 가능.
- 보완: EAS에 APNs 키·FCM 자격증명 1회 등록(추상화되는 건 전송 코드).
- 대안: FCM/APNs 직접(키 2종·분기 → 오버), OneSignal(수탁자·약관 + 기능 중복) — 미채택.

### ADR-091: 알림 2종 + DB assigned_date<=today 합산 + current move 1개

- 결정: 데일리 다이제스트 + D-day 마일스톤(7/3/1/0)만. 다이제스트 카운트 = `assigned_date <= kstToday AND 미완료`. 09:00 KST 단일 Cron, 겹치면 1건 병합. 발송은 **current active move 1개**(useCurrentMove 기준) — 다중 active move 동시 알림은 v1.1.
- 이유: 알림 피로 vs 리텐션 균형. 표시 레이어(프론트 재배치)와 발송 판단(백엔드 DB 단일 진실) 의도적 분리. 멀티 move 합산/라우팅 모호성을 1개 기준으로 제거.
- 대안: 오늘 것만(밀린 항목 누락), 프론트 재배치 백엔드 재현(중복) — 미채택.

### ADR-092: 권한 soft-ask→hard-ask + persistent 1회 가드 + 하이브리드 위임

- 결정: 온보딩 직후 soft-ask 모달 1회(`users.push_prompt_seen_at`로 persistent 가드) → 긍정 시 OS 권한(hard-ask). 권한·토큰은 네이티브 전용이라 웹은 soft-ask만, `REQUEST_PUSH_PERMISSION`로 위임. 거부 시 설정 토글 재개.
- 이유: iOS 권한 1회성 → 첫 실행 요청 안티패턴. soft-ask로 거부 박제 회피. 세션 플래그는 reload/재시작에 취약해 DB 컬럼으로.
- 트레이드오프: 모달 1단계 + 컬럼 1개. 이득 큼.

### ADR-093: push_tokens는 register-push-token Edge Function + service_role only

- 결정: `push_tokens`는 클라이언트 직접 INSERT/UPDATE 금지(service_role only). 네이티브는 토큰 발급 후 `register-push-token`(verify_jwt=true, anon getUser 검증) 호출 → service_role로 `onConflict:token` upsert.
- 이유: 본인 RLS를 검토했으나 토큰 재할당(기기 양도·재설치·계정삭제 후 새 익명) 시 `ON CONFLICT DO UPDATE`가 다른 user의 row를 갱신해야 하는데 `USING(auth.uid()=user_id)`가 막아 실패. service_role 등록으로 회피. generate-ai-guide/kakao-token-exchange의 "anon getUser + service_role 쓰기" 패턴과 일관. 토큰 값이 웹을 거치지 않음.
- 정리: `on delete cascade`로 cleanup(ADR-076)·계정삭제(ADR-082) 시 자동 삭제.
- 대비: Apple refresh_token(ADR-077)도 service_role only지만 *계정 권한 토큰*이라 그렇고, push token은 _재할당 RLS 충돌_ 때문 — 같은 결론·다른 사유.

### ADR-094: send-notifications = Cron(verify_jwt=false) + claim 모델 멱등 + DRY_RUN

- 결정: `send-notifications`는 Cron 전용이라 `verify_jwt=false` + Vault `PUSH_CRON_TOKEN` 내부 검증(cleanup 답습). 멱등은 `notification_log` claim 모델 — `status='claimed'` 선점(`ON CONFLICT DO NOTHING`) → 전송 → `sent`/`failed`. 마일스톤 멱등 키에 `milestone_date` 포함(이사일 변경 대응). KST today는 DB `(now() AT TIME ZONE 'Asia/Seoul')::date`. ticket-level 무효 토큰 삭제. 첫 배포 DRY_RUN → EXECUTE.
- 이유: 발송 전 insert만 하면 전송 실패가 영구 skip → claim/sent/failed로 실패 가시성+멱등 동시 확보. milestone_day만으론 이사일 변경 시 새 D-day 막힘. Deno는 UTC라 날짜를 DB로 고정. Vault로 호출 토큰 노출 0.
- 보완: 자동 재시도 없음(failed 기록만). receipt polling·분산 발송·token-level 로그는 후속. 1회 처리 상한(~500u/~1000t) 초과 시 truncated 로그.

### ADR-095: 딥링크 = 페이로드 route(allowlist) + 콜드스타트 WEB_READY 재사용

- 결정: Expo `data.route`로 목적지(기본 `/dashboard`). 네이티브가 응답 수신→`NAVIGATE`. 콜드스타트는 보류→`WEB_READY`(ADR-049) 후 flush. route는 네이티브·웹 양측에서 `normalizePushRoute` allowlist 검증.
- 이유: 페이로드 기반은 거의 0 비용으로 v1.1 목적지 확장. 콜드스타트 유실은 세션 주입 패턴 재사용. 푸시 페이로드를 라우팅 신뢰 경계로 보지 않고 allowlist 방어.
- 대안: 항상 대시보드 고정(확장 시 양쪽 재작업) — 미채택.

### ADR-096: 설정 1토글 + set_push_enabled RPC + 2레이어 + Expo 수탁

- 결정: 전체 on/off 1토글(`users.push_enabled`, 기본 false). `public.users`가 UPDATE 차단(10-2)이라 **`set_push_enabled`/`set_push_prompt_seen` RPC**(DEFINER + auth.uid())로만 변경. OS 권한과 앱 토글 2레이어(둘 다 충족해야 발송). 약관에 Expo(US) 수탁·국외이전 + "기기 푸시 토큰" 고지.
- 이유: 알림 2종이라 종류별 토글 과함. users 보안성 컬럼을 열지 않으려 화이트리스트 RPC(update_move_with_reschedule 패턴). push_enabled 기본 false가 effective status를 정확히 반영. 11단계 국외이전 고지 계승.

---

## 13. 완료 확인 체크리스트

### DB / RPC

- [ ] `push_tokens`(service_role only, token UNIQUE, cascade) / `notification_log`(claim 모델, digest·milestone+milestone_date unique) / `users.push_enabled`(default false)·`push_prompt_seen_at`
- [ ] `set_push_enabled` / `set_push_prompt_seen` RPC (DEFINER + auth.uid() + search_path, authenticated GRANT)
- [ ] cleanup(ADR-076)·deleteUserData(ADR-082) user 삭제 시 토큰/로그 cascade 정리 확인

### Edge Functions

- [ ] `register-push-token`: verify_jwt=true, anon getUser 검증, isExpoPushToken/platform 검증, service_role onConflict upsert
- [ ] `send-notifications`: **config.toml verify_jwt=false**, PUSH_CRON_TOKEN 내부 검증, DB 기준 kstToday, current move 1개 선택, claim INSERT ON CONFLICT, milestone_date 기록, 병합 skip 규칙, 전송 후 sent/failed 갱신, ticket-level 토큰 삭제, 처리 상한 truncated, structured log
- [ ] **DRY_RUN 1회 검증** → EXECUTE 전환

### 네이티브

- [ ] expo-notifications/expo-device/expo-constants, Android default 채널
- [ ] registerPush: projectId fallback, register-push-token 호출, 성공 시 set_push_enabled(true), **hasToken=등록성공 여부**
- [ ] 포그라운드 핸들러, 응답 리스너(route normalize→NAVIGATE), 콜드스타트 보류→WEB_READY flush
- [ ] 실기기 토큰 발급 + 토큰 재할당(재설치/계정전환) 시 user_id 갱신 확인
- [ ] **구현 직전 SDK 55 기준 expo-notifications 최신 문서로 핸들러(`shouldShowBanner` 등)·권한·토큰 API 재확인** (버전별 필드명 변동)

### 웹

- [ ] soft-ask: `push_prompt_seen_at` persistent 가드(재시작/reload 재노출 0), 받기/나중에 모두 set_push_prompt_seen
- [ ] 설정 토글: set_push_enabled RPC(직접 update 금지), effective status 표대로, OS denied 안내+설정 이동
- [ ] NAVIGATE: normalizePushRoute allowlist(외부URL/javascript: 차단)

### Cron / 운영

- [ ] Cron 09:00 KST + Vault PUSH_CRON_TOKEN, 같은 날 재실행 중복 발송 0
- [ ] 발송 실패 시 failed 기록(영구 skip 아님) 확인
- [ ] EAS APNs/FCM 자격증명, 약관/`/privacy`/App Privacy(보수 분류)/Data Safety 반영
- [ ] `pnpm build` / `lint` / `test` + mobile typecheck

---

## 14. 엣지케이스 / 주의

- **users UPDATE 차단**: push_enabled/push_prompt_seen_at은 RPC로만 변경. 직접 `.update()`는 RLS에 막힘.
- **토큰 재할당**: 재설치/복원/계정전환으로 같은 토큰이 다른 user에 → register-push-token(service_role)이 onConflict로 user_id 최신화. 본인 RLS 직접 upsert였으면 막혔을 케이스.
- **전송 실패 ≠ 영구 skip**: claim 모델이라 failed로 기록, 멱등 conflict로 박제되지 않음. 다이제스트는 다음날 새 sent_date로 재시도됨(자연). 마일스톤은 그 날짜 1회(자동 재시도 X).
- **이사일 변경**: milestone_date 덕에 새 D-day 알림 발송. 단 자주 바꾸면 D-day가 여러 번 올 수 있음(허용 범위).
- **스마트 재배치 ↔ 발송 기준**: 화면(재배치)과 푸시(assigned_date<=today)의 "오늘" 정의 차이는 의도(ADR-091). 카피는 "오늘 챙길 일"로 모호 — 특정 화면 수치와 1:1 약속 안 함.
- **다중 active move**: current move 1개만 기준. 나머지 move의 마일스톤/할 일은 12단계 발송 대상 아님(v1.1).
- **KST 경계**: 9시 발송이라 자정 근처 날짜 경계 이슈 적음. 그래도 모든 비교를 DB kstToday로 통일.
- **권한 denied + 토글 ON 시도**: 토큰 발급 불가 → hasToken=false, 발송 0. 설정 안내로 OS 설정 유도.
- **DRY_RUN 잔존 금지**: 검증 후 false 확인(true면 영원히 미발송).
- **dev=prod(ADR-075)**: 단일 프로젝트에서 실유저 직접 발송 → DRY_RUN 검증 필수. 분리 트리거 도달 시 prod 전용 Cron 이관.
- **처리 상한**: 현 규모 무관하나 truncated 로그로 한계 가시화 — 분산은 후속.
- **expo-notifications SDK 버전 변동 (구현 직전 재확인)**: `setNotificationHandler`의 핸들러 필드명이 버전마다 바뀐다(구버전 `shouldShowAlert` → SDK 53+ `shouldShowBanner`/`shouldShowList`). 권한 API(`requestPermissionsAsync`)·`getExpoPushTokenAsync` 시그니처·Android 채널 옵션도 변동 가능 → **구현 직전 SDK 55 기준 expo-notifications 최신 문서로 핸들러/권한/토큰 API를 재확인**한다(11단계 "SDK 설정값 버전별 변동 → 구현 직전 재확인" 패턴과 동일). §5의 코드 블록은 작성 시점 기준 예시.

---

## 15. 면접 대비 핵심 포인트

- **"왜 Expo Push?"** — 1인 운영 부담 최소화 + 추상화로 양 플랫폼 토큰 통합. 규모 시 토큰 매핑만 교체해 직접 전환. EAS 자격증명 등록은 필요하다는 한계도 인지.
- **"알림 2종으로 제한한 이유?"** — 알림 피로 vs 리텐션 균형, MVP 절제, 같은 Cron으로 비용·복잡도 추가 0.
- **"push token을 왜 service_role only Edge Function으로 등록?"** — 본인 RLS가 직관적이지만, 토큰 재할당 시 `ON CONFLICT DO UPDATE`가 다른 user의 row를 건드려야 하는데 RLS `USING`이 막아 실패. RLS와 upsert의 상호작용을 이해하고 Edge Function(service_role) 등록으로 우회. Apple refresh_token과 결론은 같지만(service_role only) 사유가 다름(계정 권한 vs 재할당 충돌).
- **"users.push_enabled를 왜 RPC로?"** — `public.users`는 provider/email 위조를 막으려 UPDATE 전면 차단(10-2). push_enabled도 컬럼 화이트리스트 RPC(DEFINER+auth.uid())로 — 일관된 보안 패턴.
- **"중복 발송 / 발송 실패는?"** — notification_log claim 모델. claimed 선점(unique+ON CONFLICT) → sent/failed. 발송 실패가 멱등 conflict로 영구 skip되지 않게 status 분리. 재시도/디버깅 가시성 확보.
- **"이사일 바뀌면 D-day 알림은?"** — 멱등 키에 milestone_date 포함. 날짜가 바뀌면 새 D-day로 인식해 재발송. (move_id, milestone_day)만이면 막혔을 버그.
- **"Cron 인증은?"** — send-notifications는 Cron 전용 서버-서버라 verify_jwt=false + Vault 토큰 내부 검증(cleanup 패턴). 유저 호출 함수(register-push-token)는 verify_jwt=true 유지.
- **"날짜 계산은?"** — Deno는 UTC라 `new Date()`로 KST가 9시간 어긋남 → DB `(now() AT TIME ZONE 'Asia/Seoul')::date`로 고정. D-day·assigned_date 비교의 기준.
- **"종료 상태에서 알림 누르면?"** — 콜드스타트 라우팅 유실 → 인증 세션 주입에 쓰던 WEB_READY 패턴 재사용으로 보류→flush. 푸시 route는 allowlist 방어.
- **"무료/dev=prod에서 안전?"** — Expo Push·pg_cron 무료. 실유저 직접 발송이라 DRY_RUN 선검증. Vault로 토큰 노출 0.

---

## 16. 다음 단계 (스펙 외)

- **v1.1 알림 확장**: 항목별 critical 마감 / 휴면 복귀 / **계약 만료일 알림**(DECISIONS §2-8). route·notification_log·종류별 토글 도입으로 수용. 다중 active move 알림도 여기서.
- **receipt polling**: ticket-level → push receipt 조회로 DeviceNotRegistered 정밀 정리.
- **자동 재시도**: failed 로그 기반 재발송 정책.
- **token-level delivery log**: 다기기 전송 성공/실패 토큰별 기록.
- **발송 분산**: 처리 상한 초과 시 배치/큐.
- **A/B·세그먼트**: 문구·시각 실험(PostHog 연계), 실유저 데이터 후.
