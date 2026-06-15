# 11: 관측 (Observability — Sentry · PostHog · 업타임)

> **버전**: v2 (GPT 리뷰 반영 — 환경 판정 명시화, PostHog identify를 익명 Sign-In 구조에 맞게 정정, PII/IP 표현 보정, Sentry 스크럽·sourcemap 구체화, 브릿지 타임아웃 false positive 방어, health 엔드포인트 규격화, 이벤트 택소노미 보강)
> **한 줄 요약**: 공개 출시 전, "유저가 겪는 장애(Sentry) · 앱 안 행동/지표(PostHog) · 서비스 생존(업타임)"을 보는 눈을 만든다. 웹뷰 하이브리드 특성과 dev=prod(ADR-075) 환경을 전제로, 민감정보(주소·연락처·메모·사진·이메일)를 이벤트로 내보내지 않는 PII 스크럽을 스펙의 중심에 둔다. 무료→유료 전환 트리거(ADR-075) 감지도 이 관측 레이어가 겸한다.

> **선행 조건 / 전제**
>
> - dev=prod 단일 Supabase 프로젝트(ADR-075). 데이터 레이어는 단일이나 **관측 레이어(Sentry/PostHog)는 환경을 분리**한다(§4).
> - 앱은 Expo 네이티브 셸 + WebView(웹 React 앱 로드) 하이브리드. 로직 대부분이 웹 층에 있음.
> - **모든 사용자는 앱 첫 실행부터 Supabase Anonymous Sign-In으로 stable `auth.uid()`를 가짐**(10-1). "로그인 전엔 ID 없음"이 아니라 "소셜 연결 전에도 안정적 uid 있음"이 맞다 — PostHog 설계의 핵심 전제(§2).
> - 현재 공개 배포는 `isakok.vercel.app` 단일 alias(internal=prod, dev=prod, 10-3 §4-7). 공개 URL 활성화는 출시 후.
> - 유입(획득)은 스토어 설치 경로 → "어디서 왔나" 류는 스토어 콘솔 소관, PostHog는 "설치 후 앱 안 행동"만 담당.
> - gitleaks / Dependabot은 이미 운영 중(이 스펙 범위 아님).

---

## 0. 범위 / 작업 순서

### 0-1. 하는 것 / 안 하는 것

**하는 것 (스펙 본체)**

- **§1 Sentry** — 웹 전용(@sentry/react) + 웹 쪽 브릿지 실패 로깅. (ADR-084)
- **§2 PostHog** — 이벤트만 + autocapture off, 리전 US, distinct_id=auth.uid(). (ADR-085)
- **§3 업타임** — UptimeRobot + 헬스체크 Edge Function + 이메일/Discord 알림. (ADR-086)
- **§4 환경 분리** — `VITE_APP_ENV` 명시 판정 → Sentry 1개+태그 / PostHog dev·prod 2개. (ADR-087)
- **§5 PII 스크럽 (관통)** + **§6 개인정보처리방침 갱신**. (ADR-088)

**안 하는 것 (→ §10 다음 단계로 분리)**

- **스토어 콘솔**(Android Vitals / App Store Connect 크래시·분석) — 코드 작업 없이 "켜고 확인"이라 **운영 체크리스트**로 분리.
- **Lighthouse CI / Web Vitals / E2E(Playwright) / 번들 사이즈 가드** — 품질 레인, 후속 스펙(12+).
- **푸시 알림** — 별도 기능 스펙(12).
- **Sentry 네이티브 SDK**(@sentry/react-native) — 네이티브 크래시는 스토어 콘솔에 위임. 네이티브 크래시/WebView 로드 실패가 실제 문제로 떠오르면 후속 도입(ADR-084 Follow-up).
- **PostHog 세션 리플레이 / autocapture / person properties** — PII 밀도 때문에 미사용(ADR-085).
- **Sentry performance tracing** — `tracesSampleRate: 0`으로 시작. 성능 레인에서 별도 도입.
- **공개 상태 페이지(status page)** — 실유저 생긴 뒤 검토.

### 0-2. 작업 순서 (Phase) — 의존성 기준

**Phase A — 공통 기반**

- `getEnv()` 환경 판정 유틸(`VITE_APP_ENV` 1순위, host fallback) + 새 환경변수 + **Sentry 프로젝트 1개 / PostHog 프로젝트 dev·prod 2개** 생성(§4). 이후 모든 SDK init이 이 위에 올라감.

**Phase B — Sentry (§1, P0)**

- 웹 init + PII 스크럽(§5) + release/소스맵 + 브릿지 실패 로깅.

**Phase C — 업타임 (§3, P0)**

- 헬스체크 Edge Function 신설 → UptimeRobot 모니터 2개 → 이메일/Discord 알림.

**Phase D — PostHog (§2, P1)**

- init(autocapture off) + 이벤트 택소노미 + identify(auth.uid()).

**Phase E — 법무 (§6, P0, 코드와 병렬)**

- 개인정보처리방침 처리위탁/국외이전에 Sentry·PostHog 추가. `/privacy` 반영.

### 0-3. 우선순위

- **P0 (출시 전 필수)**: §1 Sentry, §3 업타임, §5 PII 스크럽, §6 방침 갱신.
- **P1**: §2 PostHog (MAU/퍼널 — 출시와 함께면 충분).

### 0-4. 마이그레이션

- **없음.** 헬스체크 Edge Function은 기존 테이블을 가볍게 조회만 함(신규 테이블/컬럼 없음). DB 스키마 변경 0.

---

## 1. Sentry — 웹 전용 + 브릿지 실패 로깅 (ADR-084)

### 1-1. 결정

- 에러 추적은 **웹 층만**(`@sentry/react`): WebView 안 React 에러 · unhandled rejection · API 실패.
- **네이티브 셸 크래시는 Sentry로 잡지 않고 스토어 콘솔**(Android Vitals / App Store Connect)에 위임.
- 웹과 네이티브 크래시 사이 사각지대인 **"브릿지 실패"는 웹 쪽에서 Sentry로 캡처**(아래 1-2).
- **`tracesSampleRate: 0`** — performance tracing 미사용(출시 전 목표는 에러 감지, 성능은 후속 레인).

### 1-2. 구현 방향

- `apps/web` 엔트리에서 `Sentry.init`:

```ts
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: getEnv(), // §4
  release: import.meta.env.VITE_SENTRY_RELEASE, // §1-3, sourcemap upload와 동일값 필수
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend, // §5-2 스크럽 훅
})
```

- **소스맵 업로드**: `@sentry/vite-plugin`으로 빌드 시 업로드(스택트레이스 가독화). 필요한 빌드 환경변수: `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT`. 업로드 authToken은 빌드 시크릿(코드/클라이언트 노출 금지).
- **release 일치 규칙 (중요)**: SDK `init`의 `release`와 sourcemap upload의 release가 **반드시 같은 값**이어야 함(불일치 시 sourcemap 올려도 매핑 안 됨). 형식 고정: `isakok-web@<git-sha>`. Vercel build env에서 `VITE_SENTRY_RELEASE=$VERCEL_GIT_COMMIT_SHA`.
- **소스맵 공개 방지**: vite build에서 sourcemap을 생성하되, Sentry 업로드 후 `dist/**/*.map`을 삭제(vite-plugin의 sourcemap 삭제 옵션 또는 postbuild 삭제 스크립트). 산출물에 .map 미포함.
- **user context는 id만**: `Sentry.setUser({ id: user.id })`. email/주소/ip 설정 금지(§5-2).
- **브릿지 실패 로깅** (네이티브↔웹, ADR-047 `{type, payload}` / ADR-049 흐름 기준) — false positive 방어 포함(§1-3):
  - `WEB_READY` 전송 후 타임아웃 내 `AUTH_SESSION` 미수신 → `bridge_auth_session_timeout`(warning)
  - BridgeMessage 파싱 실패(JSON.parse 실패 또는 `{type, payload}` 위반) → `bridge_message_malformed`

### 1-3. 브릿지 타임아웃 false positive 방어 (필수 규칙)

- **네이티브 WebView 환경에서만** 측정. 일반 브라우저·공개 라우트(`/privacy`, `/terms`, `/health` 등 — 세션 게이트 바깥, AUTH_SESSION이 원래 안 옴)는 **제외**.
- 타이머는 `WEB_READY` 전송 직후 시작, `AUTH_SESSION` 수신 시 cancel.
- 타임아웃 **30초** = "진짜 실패" 확정 시점. 늦게라도 `AUTH_SESSION`이 도착하면 타이머를 cancel해 **조용히 복구**(경고 없음). 30초 내내 미수신일 때만 1회 capture → "느림"이 아니라 "정말 안 옴"만 잡는다. (초기값 12초는 보급형 기기·느린 네트워크의 정상 콜드스타트를 오탐 → 2026-06-15 상향.)
- **동일 WebView instance당 1회만** capture(탭 재마운트·재시도 알림 폭주 방지).
- **production에서만** Sentry warning. development는 `console.warn`만.
- 허용 컨텍스트(전부 비식별): `route_name`, `tab_name`, `elapsed_ms`, `webview_instance_id`, `app_env`, `is_native_webview`.
- 금지 컨텍스트: user email / 주소 / storage_path / memo / full URL query.

### 1-4. 웹 Sentry로 못 잡는 사각지대 (명시)

웹 Sentry는 **웹 JS가 뜬 이후**만 잡는다. 아래는 잡히지 않음 → 스토어 콘솔 / 수동 실기기 검증에 위임:

- WebView 자체 로드 실패(URL 못 받음 → 빈 화면)
- 네이티브 앱이 WebView 표시 전에 크래시
- 네이티브 탭바/브릿지 코드의 JS runtime 진입 전 장애

대응: WebView `onError`/`onHttpError`는 **네이티브 fallback UI**로 표시(웹 SDK가 뜨기 전이라 원격 로깅은 보장 못 함). 스토어 콘솔에서 네이티브 크래시/WebView load failure가 출시 후 주요 장애로 확인되면 `@sentry/react-native` 도입(ADR-084 Follow-up).

### 1-5. 주의 / 엣지케이스

- WebView 내부에서 Sentry ingest 도메인이 CSP/네트워크 allowlist에 허용되는지 확인(막히면 에러 조용히 유실).
- SDK 설정값(init·vite-plugin API)은 버전별 변동 → **구현 직전 최신 문서 재확인**.
- Sentry 전송 실패가 앱 기능을 깨면 안 됨(§9 — swallow/log-only).

---

## 2. PostHog — 이벤트만 + autocapture off (ADR-085)

### 2-1. 결정

- `posthog-js`. **autocapture off · 세션 리플레이 off · 자동 pageview off · person properties 미사용** — 내가 정의한 **이벤트만 수동 전송**.
- **리전 = US** (한국 리전 없음; PII 없는 이벤트라 US/EU 규제 차이 실익 없음 → 기능 풀세트인 US).
- **distinct_id = Supabase `auth.uid()`** (익명 사용자 포함 — 아래 2-3).

### 2-2. 구현 방향

- `posthog.init`:
  - `api_host`: US 리전 ingest 호스트 (구현 직전 PostHog 문서로 호스트 값 확인)
  - `autocapture: false`, `capture_pageview: false`, `disable_session_recording: true`
  - IP 비저장 옵션(이벤트 속성으로 IP 미저장)
  - 프로젝트 키: `VITE_POSTHOG_KEY` (환경별 = dev/prod **별도 프로젝트**, §4)
- **이벤트 택소노미** (수동 `capture`, 속성은 비식별 화이트리스트만):
  - 온보딩 퍼널: `onboarding_started` → `moving_date_set` → `checklist_generated`
  - 인증: `signup` / `login`
  - 계정 삭제: `account_delete_requested`(삭제 전, user.id로) / `account_delete_completed`(삭제 성공 후 새 익명 세션에서, **이전 userId 미포함**) / `account_delete_failed`
  - 사진 게이트(ADR-074): `photo_gate_shown` / `photo_gate_login_clicked` / `photo_gate_cancelled`
  - 네이티브 미디어(ADR-079): `native_media_picker_opened` / `native_media_upload_succeeded` / `native_media_upload_failed`
  - 체크리스트: `checklist_item_toggled`(속성: 카테고리·완료여부 — **항목 텍스트/메모 금지**)
  - 사진 업로드: `photo_uploaded`(속성: count · room_type **enum만** — 경로/파일명/custom room name 금지)
  - 재배치: `reschedule_mode_changed`(속성: 모드명)
  - → MAU · 온보딩 퍼널 · 사진 게이트 전환율 · 리텐션 산출 근거.
  - **주의**: `bridge_*` 류(타임아웃/파싱 실패)는 **Sentry에만** 보냄(§1). PostHog 이벤트로 중복 전송하지 않음(에러 관심사 ≠ 행동 퍼널).
- **이벤트 속성 allowlist** (구현 시 상수로 강제):

```ts
const ALLOWED_EVENT_PROPS = {
  checklist_item_toggled: ['category', 'completed'],
  photo_uploaded: ['count', 'room_type'],
  reschedule_mode_changed: ['mode'],
}
```

### 2-3. distinct_id / identify — 익명 Sign-In 구조에 맞춤 (정정)

- 이 앱은 모든 사용자가 앱 첫 실행부터 Anonymous Sign-In으로 stable `auth.uid()`를 가짐. 따라서 **PostHog 기본 anonymous distinct_id를 쓰지 않고**, `auth.uid()`를 distinct_id로 사용.
- **`AUTH_SESSION` 수신 후 `posthog.identify(user.id)` 호출**. 익명 사용자도 uid가 있으므로 동일하게 identify.
- `AUTH_SESSION` 전 이벤트는 **수집하지 않거나**, `app_boot_pre_session` 같은 제한 이벤트만 비식별로.
- **소셜 `linkIdentity` 성공 시 `auth.uid()`가 유지되므로 alias 불필요** → 기본 미사용.
- **예외(Follow-up)**: 폴백(`linkIdentity` 실패 → `signInWithIdToken`)으로 `user.id`가 바뀌는 케이스가 생기면 그때 alias 전략 별도 검토(현재 폴백 발동률 데이터 없으므로 미선구현).
- 효과: MAU·온보딩 퍼널·사진 게이트 전환율이 한 user 기준으로 끊김 없이 이어짐.

### 2-4. 주의 / 엣지케이스

- person properties 미사용(§5-3). `$name`/email/phone/주소/memo/moveDate 절대 금지.
- dev=prod라도 **환경별 프로젝트 키 분리(§4)로 내 테스트가 prod MAU에 안 섞이게** — 지표 신뢰성의 핵심.
- 호스트·init 옵션은 구현 직전 PostHog 문서 재확인.
- PostHog 전송 실패가 앱 기능을 깨면 안 됨(§9).

---

## 3. 업타임 모니터링 + 헬스체크 Edge Function (ADR-086)

### 3-1. 결정

- 도구 = **UptimeRobot**(무료, 5분 간격). 감시 대상 **2개**:
  1. **웹 URL** — 현재 공개 alias(`isakok.vercel.app`, internal=prod). Vercel 멈춤/빌드 깨짐/DNS 감지.
  2. **헬스체크 Edge Function** — "웹뿐 아니라 DB까지 살아있다"를 증명.
- 알림 = **이메일 + Discord 웹훅**(다운/복구 시). SMS(유료) 미사용.

### 3-2. 헬스체크 Edge Function `health` 규격 (필수)

- `supabase/functions/health`:
  - **메서드**: `GET`/`HEAD`만 허용. 그 외 `405`.
  - **응답**: `200 {"status":"ok"}` 또는 `503 {"status":"error"}`만. **DB 값·version·config key·row content 미반환.**
  - **쿼리**: `select 1` 수준 RPC 또는 `system_config` count 1개. 특정 key/value 미반환.
  - **권한**: service_role 미사용 기본. anon/public SELECT 가능한 `system_config` 1행 조회로 충분한지 확인. RLS/권한 때문에 false negative가 잦으면 service_role 검토하되 **반환 데이터는 0 유지**. health가 의존하는 테이블/정책을 명시(RLS 변경으로 health가 깨지지 않게).
  - **abuse 방지**: 비싼 쿼리 금지, timeout 1~2초, `Cache-Control: no-store`, 로그에 요청 IP/헤더 원문 미기록.
- 5분마다 DB를 가볍게 접촉 → Supabase 7일 비활동 정지(pause) 방지에 **도움이 될 수 있으나 부수효과**(§3-4).

### 3-3. UptimeRobot 설정

- 모니터 2개(5분): 웹 URL(상태코드/키워드) + `health`(200 + `"ok"` 키워드).
- 모니터 이름에 환경 접미사: `isakok-web-prod`, `isakok-health-prod`.
- 알림: 이메일 + Discord 웹훅(다운/복구).
- **출시 후 공개 URL 활성화 시**: 공개 production URL로 재지정(또는 추가). 현재는 dev=prod 단일 alias라 prod 2개만 필수.

### 3-4. 주의 / 엣지케이스

- 헬스의 **주 목적은 서비스 생존 확인**. Supabase inactivity pause 방지는 부수효과로 본다(플랜/정책 변동 가능).
- dev=prod라 핑이 prod DB에 가지만 `select 1` 수준이라 부하 무시.
- 5분 간격이라 최대 ~5분 다운 후 감지 — 1인 운영엔 충분.

---

## 4. 환경 분리 (dev=prod에서 내 테스트 격리) (ADR-087)

### 4-1. 결정

- Supabase는 단일이나 관측 레이어는 환경 분리:
  - **환경 판정은 `VITE_APP_ENV` 명시 변수 1순위**, host 기반은 fallback만.
  - **Sentry** = 프로젝트 1개 + `environment` 태그(production 알림만 라우팅).
  - **PostHog** = **dev/prod 별도 프로젝트**(키를 환경별로) → prod 지표가 원천적으로 진짜 유저만.
    - > **구현 정정(2026-06-06)**: PostHog Free 플랜(프로젝트 1개) 제약으로 **단일 프로젝트 + `environment` super-property 태그**로 변경(`posthog.register({ environment: getEnv() })`). 대시보드에서 `environment=production` 필터로 분리(Sentry `environment` 태그와 동일 메커니즘). `VITE_POSTHOG_KEY`는 단일 키. 근거·트레이드오프는 ADR-088.

### 4-2. 구현 방향

```ts
export type AppEnv = 'development' | 'production'

export function getEnv(): AppEnv {
  const explicit = import.meta.env.VITE_APP_ENV
  if (explicit === 'production' || explicit === 'development') return explicit
  // fallback only
  return import.meta.env.PROD ? 'production' : 'development'
}
```

- **Vercel deployment별 `VITE_APP_ENV` 명시**: production deployment = `production`, preview/internal/dev deployment = `development`(또는 의도값). host·alias 변경에 흔들리지 않음.
- Sentry: `environment: getEnv()` → prod 대시보드/알림 필터 production.
- PostHog: `VITE_POSTHOG_KEY`를 dev 프로젝트 키 / prod 프로젝트 키로 환경별 주입.

### 4-3. 주의 / 엣지케이스

- internal alias가 production으로 오분류되거나 preview가 production 키로 새지 않게 **각 deployment에서 실측**.
- dev 에러가 `development` 태그로 보이되 prod 알림 채널엔 안 가게 라우팅 확인.

---

## 5. PII 스크럽 (스펙 관통 — ADR-088 일부)

### 5-1. 이 앱에서의 PII 정의

- **주소 · 연락처 · 메모 · 사진(파일/경로) · 이메일.** 이 다섯은 Sentry/PostHog **이벤트 payload에 절대 전송 금지**. 10-3의 "Anthropic엔 PII 미전송" 원칙을 관측 레이어로 확장.

### 5-2. Sentry 스크럽 (denylist + allowlist)

- `sendDefaultPii: false`. `Sentry.setUser({ id: user.id })`만(email/ip 금지).
- `beforeSend`에서 삭제/마스킹:
  - `event.request.headers.authorization` / `.cookie` / `['x-supabase-auth']`
  - `event.request.cookies` / `.data` / `.query_string`
  - `event.user.email` / `.ip_address`
  - `breadcrumb.data.{storage_path, file_name, address, memo, phone, email}`
- URL은 query 제거:

```ts
function stripUrl(url?: string): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    return url.split('?')[0]
  }
}
```

- **extra/context는 allowlist 기반으로만** 추가. raw form data, Supabase response 원문, storage_path, file name, memo, address는 extra/context에 넣지 않음.
- 금지 예: `setUser({ email })`, `setContext('move', { address, memo })`, `captureException(error, { extra: rawFormData })`.

### 5-3. PostHog 스크럽

- autocapture/replay off로 입력·DOM 텍스트 수집 경로 원천 차단.
- `distinct_id` = uuid만. IP 이벤트 속성 미저장.
- **person properties 미사용**(후속에 `user_type`/`provider` enum 정도만 허용 검토). `$name`/email/phone/주소/memo/moveDate 금지.
- 이벤트 속성 화이트리스트(§2-2 `ALLOWED_EVENT_PROPS`).

### 5-4. 검증

- 실제 이벤트/에러 페이로드를 Sentry·PostHog 대시보드에서 열어 **주소/메모/이메일/사진경로가 이벤트에 없는지 육안 확인**(verify 필수).

---

## 6. 개인정보처리방침 갱신 (ADR-088 일부)

- 10-3 **처리위탁 / 국외이전** 항목에 두 수탁자 추가(기존 표 구조 확장):
  - **Sentry** — 위탁업무: 오류 진단 / 이전 항목: 기술적 오류정보(스택트레이스·임의 식별자(uuid)·기기·브라우저) / 보유기간 명시.
  - **PostHog (US)** — 위탁업무: 이용 통계 분석 / 이전 항목: 행동 이벤트 + 임의 식별자(uuid) / 보유기간 명시.
- **표현 정확화 (단정 금지)**: "PII 미전송·IP 미수집"이라 단정하지 않는다. 정확히는:
  - "주소·연락처·메모·사진·이메일은 이벤트 payload에 전송하지 않음."
  - "uuid 기반 임의 식별자와 기술적 오류/행동 이벤트만 처리."
  - "IP는 분석 이벤트 속성으로 저장하지 않도록 설정하며, 서비스 제공 과정의 네트워크/접속 정보는 수탁자 정책에 따라 **최소 기술정보로 처리될 수 있음**."
- **보유기간**: 각 콘솔의 실제 retention 설정을 확인해 `/privacy`에 반영. 스펙 기본 추정값 = Sentry 30일 / PostHog 12개월(콘솔 실제값 우선, 구현 시 확인).
- `/privacy` 페이지(공개 라우트)에 반영.
- ⚠️ 국외이전 고지 요건은 구현 시 PIPC 가이드로 대조 권장(법률 자문 아님).

---

## ADR (이번 스펙 — adr.md 추가)

> ⚠️ **번호 정정**: 아래 본문은 ADR-084~088로 작성됐으나 **ADR-084는 이미 "WebView 콜드 로드 견고화"가 선점**함. `docs/ADR.md`에는 충돌을 피해 **ADR-085~089로 +1 시프트**해 등재함(Sentry 085 · PostHog 086 · 업타임 087 · 환경분리 088 · PII 089). 코드 주석·구현은 확정 번호(085~089)를 따른다.

### ADR-084: Sentry는 웹 전용 + 브릿지 실패 로깅 (tracing off)

- 결정: 에러 추적을 `@sentry/react` 웹 층에만 도입(`tracesSampleRate: 0`). 네이티브 크래시는 스토어 콘솔에 위임. 브릿지 실패(AUTH_SESSION 타임아웃·BridgeMessage 파싱)는 웹에서 Sentry로 캡처.
- 이유: 얇은 Expo 셸 + 웹뷰라 에러 대부분이 웹 층. 네이티브 SDK는 Expo 빌드 재설정·소스맵 부담 대비 효용 낮음. 브릿지 실패는 "조용한 실패"라 스토어 콘솔도 웹 Sentry 기본형도 못 잡아 명시 로깅으로 구멍을 메움. performance tracing은 출시 전 목표(에러 감지) 밖이고 PII/비용/노이즈가 늘어 0으로 시작.
- 사각지대(명시): WebView 로드 실패·WebView 표시 전 네이티브 크래시·JS runtime 전 네이티브 장애는 웹 Sentry로 못 잡음 → 스토어 콘솔/수동 검증 + WebView onError 네이티브 fallback UI.
- Follow-up: 출시 후 네이티브 크래시/WebView load failure가 주요 장애로 확인되면 `@sentry/react-native` 도입.

### ADR-085: PostHog는 이벤트만 + autocapture off, distinct_id=auth.uid()

- 결정: `posthog-js`를 autocapture·리플레이·자동 pageview·person properties off로 도입, 명시 이벤트만 수동 전송. 리전 US. distinct_id는 Supabase `auth.uid()`(익명 포함), AUTH_SESSION 후 identify. linkIdentity는 uid 유지라 alias 미사용.
- 이유: PII 밀도가 높아 autocapture/리플레이는 마스킹 시 가치 소멸·유출 위험만 남음 → 명시 이벤트가 표준. 모든 사용자가 첫 실행부터 stable uid를 가지므로(익명 Sign-In) PostHog 기본 anonymous id보다 auth.uid() distinct_id가 퍼널을 끊김 없이 잇는다. PII 없는 이벤트라 US/EU 차이 실익 없어 풀세트인 US.
- 트레이드오프: 화면 단위 관찰 불가(특정 이탈 시 스코프 마스킹 리플레이로 후속). 폴백으로 uid 변경 시 alias는 그때 별도 검토(현재 데이터 없어 미선구현).

### ADR-086: 업타임은 UptimeRobot + 헬스체크 Edge Function 2중 감시

- 결정: UptimeRobot으로 (1) 웹 URL(현재 stable alias) (2) 헬스체크 Edge Function 2개를 5분 핑. 알림 이메일+Discord. health는 GET/HEAD만, 200/503만, 데이터 미반환, timeout 1~2s, no-store.
- 이유: 웹 URL만 보면 정적 페이지 생존만 증명, health가 DB까지 찔러 "시스템이 돈다"를 증명. dev=prod 단일 alias라 모니터는 prod 2개로 충분(공개 URL은 출시 후 재지정).
- 트레이드오프: 공개 health가 작은 표면이나 경량·데이터 미반환으로 위험 무시. pause 방지는 부수효과(핵심 목적 아님).

### ADR-087: 관측 레이어 환경 분리 (VITE_APP_ENV 명시)

- 결정: dev=prod 하에서도 관측은 환경 분리. `VITE_APP_ENV` 명시 변수 1순위(host fallback)로 판정 → Sentry 1개+태그(prod 알림만), PostHog dev/prod 2개 프로젝트.
- 이유: 본인 테스트가 prod 지표(MAU/퍼널)·알림을 오염시키면 안 됨. 이 프로젝트는 preview/internal/prod alias가 섞여 host 기반 판정만으론 오분류 위험 → 명시 변수가 안전. Sentry는 dev 에러도 보며 prod 알림만 받으려 태그, PostHog는 지표 청결을 필터 규율 없이 보장하려 프로젝트 분리.
- 트레이드오프: PostHog 프로젝트 2벌 + 환경별 키 관리. 청결 지표 가치가 비용 상회.

### ADR-088: 관측 레이어 PII 스크럽 + 국외이전 고지 (표현 정확화)

- 결정: Sentry/PostHog 모두 주소·연락처·메모·사진·이메일을 이벤트 payload에 미전송, IP는 이벤트 속성 미저장. beforeSend denylist+allowlist·person properties 금지로 강제. 개인정보처리방침에 두 수탁자 처리위탁/국외이전 추가하되 "IP 미수집"으로 단정하지 않고 "최소 기술정보 처리"로 표현.
- 이유: 이사 앱은 PII 밀도가 높아 관측 도구가 무심코 주소/메모를 전송할 위험이 큼. SDK 설정은 payload/저장을 통제하나 네트워크 레벨 IP·수탁자 접속 로그는 존재할 수 있고 uuid는 가명 식별자라, 방침은 정확히 "최소 기술정보 처리"로 표현해야 정합·안전.
- 트레이드오프: 스크럽으로 일부 디버깅 컨텍스트 손실 — 프라이버시 우선이라 수용.

---

## 7. 새 환경변수

| 변수                  | 용도                | 비고                                                           |
| --------------------- | ------------------- | -------------------------------------------------------------- |
| `VITE_APP_ENV`        | 환경 판정 1순위     | deployment별 명시(production/development)                      |
| `VITE_SENTRY_DSN`     | Sentry DSN          | 환경별                                                         |
| `VITE_SENTRY_RELEASE` | Sentry release      | `isakok-web@<sha>` = `$VERCEL_GIT_COMMIT_SHA`, upload와 동일값 |
| `VITE_POSTHOG_KEY`    | PostHog 프로젝트 키 | **dev/prod 프로젝트별로 다름**                                 |
| `SENTRY_AUTH_TOKEN`   | 소스맵 업로드       | 빌드 시크릿, 클라이언트 미노출                                 |
| `SENTRY_ORG`          | 소스맵 업로드       | 빌드 전용                                                      |
| `SENTRY_PROJECT`      | 소스맵 업로드       | 빌드 전용                                                      |

- UptimeRobot / Discord 웹훅은 코드가 아니라 콘솔 설정.
- Sentry는 웹 전용이라 네이티브(`EXPO_PUBLIC_*`) 추가 없음.

---

## 8. 완료 확인 체크리스트

### Phase A — 공통 기반

- [ ] `getEnv()` (VITE_APP_ENV 1순위, host fallback)
- [ ] **Sentry 프로젝트 1개 + PostHog dev/prod 2개** 생성
- [ ] 새 환경변수 환경별 주입(Vercel production/preview 스코프)
- [ ] Vercel production/preview/internal deployment에서 `VITE_APP_ENV` 값 확인
- [ ] Sentry environment가 의도값으로 찍히는지 / PostHog 키가 의도 프로젝트로 들어가는지 확인

### §1 Sentry

- [ ] `@sentry/react` init (dsn/environment/release/`sendDefaultPii:false`/`tracesSampleRate:0`)
- [ ] `beforeSend` 스크럽 (headers/cookies/query/body/breadcrumb/user, stripUrl, allowlist extra)
- [ ] `Sentry.setUser({ id })`만
- [ ] `@sentry/vite-plugin` 소스맵 업로드 (SENTRY_AUTH_TOKEN/ORG/PROJECT) + release 일치 + `dist/**/*.map` 삭제
- [ ] 브릿지 타임아웃: native WebView only / 공개 라우트 제외 / 30s(늦은 AUTH_SESSION 도착 시 cancel=복구) / instance당 1회 / prod만 warning
- [ ] BridgeMessage 파싱 실패 → Sentry 캡처
- [ ] WebView onError/onHttpError 네이티브 fallback UI (사각지대 명시)
- [ ] WebView 내 전송 동작 + CSP/네트워크 allowlist 확인

### §2 PostHog

- [ ] `posthog-js` init (autocapture/pageview/replay off, US host, IP 미저장)
- [ ] distinct_id = auth.uid(), AUTH_SESSION 후 `identify(user.id)` (익명 포함), alias 미사용
- [ ] 이벤트 택소노미 (온보딩/인증/계정삭제/사진게이트/네이티브미디어/체크리스트/사진/재배치)
- [ ] 이벤트 속성 allowlist + person properties 미사용
- [ ] `account_delete_completed`는 새 익명 세션에서 이전 userId 미포함
- [ ] bridge\_\* 는 PostHog 미전송(Sentry 전용) 확인

### §3 업타임

- [ ] `health` Edge Function (GET/HEAD만, 405, 200/503, 데이터 미반환, timeout 1~2s, no-store, 경량 쿼리)
- [ ] UptimeRobot 모니터 2개 (웹 URL + health), 이름 환경 접미사
- [ ] 이메일 + Discord 웹훅 알림

### §4 환경 분리

- [ ] Sentry `environment` 태그 → prod 알림만
- [ ] PostHog dev/prod 키 분리 + dev 누출 없음 실측

### §5 PII 스크럽

- [ ] Sentry: user=id only, denylist 스크럽, allowlist extra/context, IP off
- [ ] PostHog: distinct_id=uuid, 속성 allowlist, person properties 미사용, IP off
- [ ] 대시보드 실 페이로드 육안 검증 (PII 없음)

### §6 방침

- [ ] 처리위탁/국외이전에 Sentry·PostHog(US) 추가 (이전 항목·국가·보유기간, "최소 기술정보 처리" 표현)
- [ ] 보유기간 콘솔 실제값 확인 후 반영
- [ ] `/privacy` 페이지 반영

### 공통

- [ ] Sentry/PostHog init·전송 실패가 앱 기능에 영향 없음 (swallow/log-only)
- [ ] `pnpm build` / `pnpm lint` / `pnpm test` 통과

---

## 9. 엣지케이스 / 주의 (통합)

- **관측 도구 장애 무영향**: Sentry/PostHog init 실패·네트워크 전송 실패(adblock/WebView 네트워크 정책/DNS)는 swallow/log-only. 관측 도구가 앱을 깨면 안 됨.
- WebView에서 Sentry/PostHog ingest 도메인이 CSP/네트워크 차단되면 데이터 조용히 유실 → allowlist 확인.
- 브릿지 타임아웃 false positive(콜드스타트·탭 재마운트·공개 라우트·브라우저) 방어 규칙(§1-3) 준수.
- dev/preview 빌드가 prod 관측 프로젝트로 새지 않게 `VITE_APP_ENV`/키 스코프 실측.
- 공개 health 엔드포인트는 데이터 미반환·경량 쿼리·timeout 고정.
- 익명→회원 identify가 한 uid로 이어지는지(퍼널 연속성) + 폴백 uid 변경 케이스 인지.
- SDK 설정값(Sentry init·vite-plugin·PostHog host/옵션)은 버전별 변동 → **구현 직전 최신 문서 재확인**.

---

## 10. 다음 단계 (스펙 외 — 별도 진행)

- **스토어 콘솔 모니터링** — Android Vitals(크래시율·ANR) / App Store Connect 분석·Xcode Organizer 크래시. 운영 체크리스트(코드 X).
- **품질 레인** — Lighthouse CI / Web Vitals / E2E(Playwright 핵심 1~2 플로우) / 번들 사이즈 가드. (12+)
- **푸시 알림** — 일정 기반 리마인더. 별도 기능 스펙(12). Supabase Cron + Edge Function(ADR-076 패턴) · 브릿지(ADR-047) · service_role only(ADR-077) 재사용.
- **Sentry 네이티브 SDK** — 네이티브 크래시/WebView load failure가 실제 문제로 떠오를 때(ADR-084 Follow-up).
- **공개 상태 페이지** — 실유저 생긴 뒤.

---

## 11. 면접 대비 핵심 포인트

- **"하이브리드인데 Sentry를 왜 웹만?"** — 로직 대부분이 웹뷰 안. 네이티브 크래시는 스토어 콘솔에 분담. 둘 사이 사각지대인 브릿지 실패(조용한 실패)는 웹에서 명시 로깅. WebView 로드 실패 같은 초기 장애도 못 잡는 걸 알고 스토어 콘솔/네이티브 fallback에 맡김. 네이티브 크래시가 실제 문제가 되면 Sentry RN 추가.
- **"PostHog distinct_id를 왜 auth.uid()로?"** — 익명 Sign-In이라 첫 실행부터 stable uid가 있음. 기본 anonymous id를 쓰면 AUTH_SESSION 전후로 퍼널이 끊기고 alias가 복잡해짐. uid로 통일하면 익명→회원이 한 사람으로 이어져 MAU·퍼널이 정확.
- **"autocapture를 왜 껐나?"** — PII 밀도가 높아 마스킹하면 가치가 사라지고 유출 위험만 남음. 명시 이벤트가 PII 밀도 높은 도메인의 표준.
- **"업타임을 웹 URL만 안 보고 health까지?"** — 웹 URL은 페이지 생존만 증명. health가 DB까지 찔러 시스템 생존을 증명. (Supabase pause 방지는 부수효과)
- **"dev=prod인데 지표가 안 더러워지나?"** — 데이터는 단일이나 관측은 환경 분리. VITE_APP_ENV 명시로 alias 오분류를 막고, Sentry 태그·PostHog 프로젝트 분리로 prod 지표를 깨끗하게.
- **"관측 도구에 개인정보가 새지 않나?"** — beforeSend denylist+allowlist·person properties 금지로 payload에서 PII 차단. 단 네트워크 레벨 IP·수탁자 로그는 존재 가능하므로 방침엔 "최소 기술정보 처리"로 정확히 표현하고 국외이전 고지.
- **"트래픽 몰리면?"** — rate limit·캐시·압축으로 폭발 반경을 이미 줄여둠. 무료→유료는 자동 결제가 아니라 이 관측 레이어로 트리거(ADR-075) 도달을 감지해 수동 전환. Supabase Pro는 spend cap 기본 ON이라 폭탄 방지.
