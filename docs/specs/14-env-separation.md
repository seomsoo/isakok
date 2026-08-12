# 14단계: Supabase dev/prod 환경 분리 스펙 (SDD) v1.1

> 목표: dev=prod 단일 프로젝트(ADR-075)를 종료하고, 실사용자 데이터(prod)와 개발 환경(dev)을 물리적으로 분리한다.
> 이 단계가 끝나면: 일상 개발·PR 프리뷰·스키마 실험·회원 플로우 테스트가 전부 dev Supabase 위에서 이뤄지고, prod는 릴리즈 채널(EAS production + Vercel Production)만 접근하는 상태. "어느 빌드가 어느 Supabase를 보는가"가 매핑 표 + startup fingerprint로 고정되고, prod 오발사는 스크립트 가드가 코드로 차단한다.

> **선행 조건**
>
> - Supabase free 슬롯 확보 완료 (다른 활성 프로젝트 정리) → **둘 다 free tier**로 진행. Pro 업그레이드 없음.
> - 13단계(Quality Lane) verify 완료 — CI(verify/e2e/rls)는 전부 로컬 스택 기반이라 이번 분리의 영향권 밖(§8).
> - 기존 프로젝트 `ybcqinanfcarhqkclvue`(Seoul)에 실사용자(내부 테스터) 데이터 존재.

> 재사용 자산: `sb_publishable_*`/`sb_secret_*` 키 체계(ADR-075 안전 게이트) · `db-backup.yml` pg*dump(ADR-075) · 로컬 Supabase E2E 격리(ADR-099) · RLS 스모크 `scripts/verify/rls-smoke.ts`(ADR-081) · `delete_my*\*`cascade · Google provider 설정 절차(ADR-052) ·`getEnv()` 환경 판정(ADR-088) · dev-wipe project-ref 가드 패턴(→ 배포·리셋 스크립트 가드로 계승).

> **설계 세션 잠금 결정 (묶음 A~E + 잔재 체크)**
>
> - **A(전제)**: 기존 `ybcqinanfcarhqkclvue` = **prod 유지**(rename `isakok-prod`), 신규 = **dev**(`isakok-dev`). 둘 다 free, 리전 Seoul 동일. [§1]
> - **B(dev 충실도)**: 스키마·RLS·함수 아티팩트 parity 100%, 런타임 연동은 의도적 부분 — 인증은 익명+Google만, cron 미스케줄(수동 invoke+DRY_RUN), 백업·UptimeRobot은 prod 전용, dev 시크릿 **전부 신규**(Anthropic dev 키+spend limit, Apple/Kakao 미투입). [§2·§3]
> - **C(CI/CD)**: CI는 로컬 스택 유지(ADR-099 "임시"→"정식" 승격), 배포는 가드 스크립트(CD 미도입), 일상 개발 = **원격 dev 직결**. [§5-2·§8]
> - **D(매핑)**: Vercel **단일 프로젝트** — Preview env=dev + `dev` 미러 브랜치에 `isakok-dev.vercel.app`. eas.json development/preview → dev 전환. cors `ALLOWED_ORIGINS` env화(**fail-closed**). DEV 배지. [§4·§5-1]
> - **추가(보안·잔재)**: prod의 dev 잔재 제거(prod 접촉의 유일 예외), prod secret 키 로컬 상주 종료, `ai_guide_cache` 1회 시딩(ADR-069 역방향), dev=prod 워크어라운드 전수 처분표. [§6·§7]
> - **철학**: ADR-075의 분리 트리거 4개 중 어느 것도 도달하기 전, free 슬롯이 확보되자 **부채를 조기 상환**하는 결정.

> **v1 → v1.1 변경 (GPT 심층 리뷰 반영 — 17항목 중 16 채택 + 1 부분 채택, 전면 기각 0)**
>
> - **[P0-1]** `supabase db reset --linked` **직접 실행 금지** → `db:reset:dev` wrapper + DEV_REF 가드(PROD_REF는 무조건 거부). "**linked 상태는 편의일 뿐 안전 경계가 아니다**" 원칙 명문화 — prod는 link 자체를 하지 않고 `--project-ref`/일시적 `--db-url`로 명시 실행. [§5-2]
> - **[P0-2]** prod의 DB push와 함수 배포 **명령 분리** — v1의 `deploy:prod`(db push 포함)는 함수 핫픽스가 대기 중 마이그레이션을 prod에 끌고 갈 수 있어 "prod 스키마 diff 0"과 충돌(설계 결함 인정). prod 통합 명령 폐기, Phase D는 `functions:deploy:prod`만. [§5-2·§6]
> - **[P0-3]** "유일한 백업" → "**prod Postgres DB의** 유일한 백업"으로 한정. `property-photos` Storage 실 객체 미백업을 **Accepted Risk + 재검토 트리거**로 명시. [§1·§11]
> - **[P1-1]** dev CORS에 **LAN origin 명시** — 네이티브 development 빌드의 WebView origin은 localhost가 아니라 `http://192.168.x.x:5173`. [§5-1·§9-1]
> - **[P1-2]** PR Preview = UI/기본 검증(OAuth·Edge 통합 **미보장이 정책**), 완전한 통합 환경 = `isakok-dev.vercel.app` 하나로 역할 분리. [§4-2]
> - **[P1-3]** dev 웹 publish를 **순서 있는 절차**로 고정(배포·SHA 확인 후에 EAS preview). [§4-2]
> - **[P1-4]** ADR 정본 위치 **`docs/ADR.md`로 통일** — 레포 확인: DECISIONS.md는 기획 스냅샷, ADR은 2026-06-05 이관(DECISIONS §14 명시). 13스펙의 "DECISIONS.md 복붙용" 표기는 관례 오기였음. [§13·§15]
> - **[P1-5]** 캐시 시딩 예시를 **secret-safe**(read -s + unset + dump 삭제)로 교체 — v1 예시가 자기 원칙("히스토리 잔존 금지")과 모순이었음. 시딩 후 검증 5종 추가. [§2-4]
> - **[P1-6]** 관측 "자동 off" 표현 **정정** — 실동작(ADR-088 확인)은 environment **태그 분리**(Sentry 알림·PostHog 지표는 production 필터), production 전용 게이트는 **RUM(ADR-102)뿐**. v1 문구가 실제 코드와 달랐음. [§4-2·§9-3]
> - **[P1-7]** "100% 동일" → **parity 층위 분리**(스키마·마이그레이션·RLS·함수 아티팩트 100% / 외부 연동·런타임 설정 의도적 부분). [§3-0]
> - **[P1-8]** seed 명령 **확정** — CLI 2.105.0 고정(CI 동일). `db push --include-seed`는 **pending 마이그레이션이 있을 때만 seed 실행**(공식 이슈 확인) → 신규 dev(28개 전부 pending)엔 성립, 재시딩은 psql fallback. [§2-2]
> - **[P1-9]** `*_ANON_KEY`/`*_SERVICE_ROLE_KEY` **변수명 ≠ legacy JWT** 주석 — 실값은 `sb_publishable_*`/`sb_secret_*`(ADR-075 게이트 3 전례). 변수명 rename은 범위 밖. [§9]
> - **[P2-1 부분 채택]** 환경 **fingerprint** — 웹 startup 검증만 도입(production×DEV_REF, 비production×PROD_REF 조합 throw). 네이티브/빌드타임 검증은 트림 — 브릿지 페어링 불일치는 이미 setSession→getUser에서 시끄럽게 실패(10-3 실측), EAS env는 스코프 고정. [§5-6]
> - **[P2-2]** verify에 백업 **restore 테스트 수동 1회**("성공한 backup job ≠ 복구 가능한 백업"). [§14]
> - **[P2-3]** `dev` 브랜치 = **deployment mirror** 선언(직접 커밋 금지, GitFlow 오해 차단). [§4-2]
> - **[P2-4]** prod 접촉을 **명령 수준 allowlist + 금지 목록**으로. [§0-3]
> - **[CORS]** fail-closed 의미론 명확화 — "묵시적 `*` 없음"이지 "dev 로컬 fallback 소멸" 아님(**합집합 규칙**). [§5-1]

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 0-1. 하는 것

- **dev Supabase 프로젝트 신규 구축**: 생성 → 키 체계(legacy JWT off) → 마이그레이션 28개+seed push → Edge Functions 9개 배포 → 시크릿 신규 세팅 → `ai_guide_cache` 1회 시딩
- **dev 인증**: 익명 로그인 + Google provider만 (콘솔 작업 최소 구성)
- **채널-환경 매핑 고정**: EAS 3프로필 × Vercel 3채널 매핑 표 + 세션 브릿지 페어링 불변식 + 웹 startup fingerprint (§4-1·§5-6)
- **코드 변경**: cors `ALLOWED_ORIGINS` env화(fail-closed) / DEV 배지 / 배포·리셋 가드 스크립트(명령 분리) / .env 역할 분리 / `db-backup.yml` 시크릿 rename
- **prod 하드닝**: localhost 잔재 제거, `ENVIRONMENT=production` 확정, prod secret 키 로컬 상주 종료
- **잔재 처분**: dev=prod 시절 워크어라운드 전수 처분표 반영 + 문서 sweep

### 0-2. 안 하는 것

- **Supabase 브랜칭(브랜치별 DB)** — Pro 기능 + 1인 프로젝트에 과투자. dev 프로젝트 하나로 충분
- **dev 자동 배포 CI**(main 머지 → dev 반영) — 시크릿 표면 확대 + free dev pause 시 CI 소음. 재검토 트리거: 협업자가 생기면
- **rls-ci.yml의 dev 실 DB 전환** — 로컬 스택이 결정적·무료·간섭 0 (§8)
- **dev 소셜 풀세팅**(Apple·Kakao) — 콘솔 작업량 대비 상시 가치 낮음. Apple/Kakao 고유 플로우는 지금처럼 prod 릴리즈 채널에서 검증 (parity 정의는 §3-0)
- **dev cron 스케줄** — 파괴적 작업 상시 실행 불필요. 수동 invoke로 대체 (§2-5)
- **dev 백업·UptimeRobot·keep-alive 핑** — dev 데이터는 버려도 되는 데이터. pause는 "필요할 때 깨운다"
- **Storage 실 객체(property-photos) 백업** — 이번 단계 범위 밖, Accepted Risk로 관리 (§11)
- **PR Preview에서 OAuth·Edge Function 통합 보장** — ephemeral URL이라 미보장이 정책. 통합 검증은 isakok-dev.vercel.app (§4-2)
- **prod 통합 deploy 명령** — DB와 함수는 prod에서 의도적으로 별도 실행 (§5-2)
- **dev-wipe.sql 부활** — 가드 wrapper `db:reset:dev`로 대체. `supabase db reset --linked` 직접 실행은 금지 (§5-2·§7)
- **dev 배포 접근 제한**(비밀번호 등) — 실데이터 없음 + RLS 동일. "dev에 실제 주소·연락처 입력 금지" 원칙으로 대체 (§11)
- **Supabase env 변수명 rename**(`SUPABASE_PUBLISHABLE_KEY` 등) — 코드 변경 범위 확대 불필요, 주석으로 의미만 고정 (§9)
- **관측(Sentry/PostHog) environment 태그 변경** — ADR-088 그대로. 범위 밖 (§11)
- **prod 도메인/DNS 변경** — 없음

### 0-3. 작업 순서 (Phase) + prod 접촉 allowlist

**prod 접촉 allowlist (명령 수준 — 이 밖의 prod 조작은 이 스펙에서 금지)**

| 분류            | 허용 작업                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| READ            | `ai_guide_cache` data-only dump **1회** (§2-4)                                                          |
| FUNCTION CONFIG | `ALLOWED_ORIGINS` 신설 / `ENVIRONMENT=production` 확인·교정                                             |
| FUNCTION DEPLOY | `functions:deploy:prod` — **함수만**                                                                    |
| AUTH CONFIG     | Redirect URLs의 localhost 항목 제거                                                                     |
| PROJECT META    | 표시 이름 rename(`isakok-prod`) — ref/URL 불변                                                          |
| GITHUB          | 백업 시크릿 rename + workflow_dispatch                                                                  |
| **금지**        | prod `db push`(마이그레이션 적용) · db reset · seed · 임의 SQL · Storage 객체 변경 · 사용자 데이터 조작 |

- **Phase A — dev 구축** (prod 무접촉, READ 1회만 예외): §1 이름 정리 + §2 전체 + §3 인증. 완료 기준: 로컬 웹(.env=dev)에서 온보딩→체크리스트→토글 스모크.
- **Phase B — 코드 변경** (dev에서 먼저 검증): §5 전체. cors env화는 **dev에 먼저 배포**해 fail-closed·LAN 허용 동작 확인.
- **Phase C — 채널 전환** (§4, 순서 고정): ① Vercel Preview env → dev ② dev 미러 브랜치 + 도메인 할당 ③ `git push origin main:dev` → 배포·SHA 확인 ④ EAS development/preview env 등록 ⑤ **그 후** eas.json 머지 ⑥ EAS preview 빌드 → 세션 브릿지 실측. (env 없이 eas.json을 먼저 머지하면 다음 dev 빌드가 깨짐)
- **Phase D — prod 접촉** (순서 엄격, §6): 시크릿 선설정 → `functions:deploy:prod`(**이 Phase에서 db push 금지**) → CORS 스모크 → 콘솔 잔재 제거 → GitHub 시크릿 rename + 백업 dispatch + restore 테스트.
- **Phase E — verify + sweep**: §14 골격 + 문서 갱신(§15).

우선순위: **P0** = Phase A·C·D 코어 + 가드 스크립트(P0-1·2) / **P1** = DEV 배지·fingerprint·.env 정리 / **P2** = 문서 sweep 세부.

---

## 1. 분리 구조 (전제 확정)

| 항목   | 결정                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| 방향   | 기존 `ybcqinanfcarhqkclvue` = **prod** (실데이터 보유, OAuth 콘솔·UptimeRobot 등 외부 설정 유지) / 신규 = **dev** |
| 요금제 | **둘 다 free** (슬롯 확보로 가능해짐, 비용 0)                                                                     |
| 리전   | dev도 **Seoul**(ap-northeast-2) — pg_cron/pg_net 등 확장 동작 포함 prod와 조건 동일화 (ADR-068 계승)              |
| 이름   | 기존 rename `isakok` → **`isakok-prod`** (ref/URL 불변 → 코드·콘솔 영향 0) / 신규 = **`isakok-dev`**              |

**free tier 유지 조건 2가지** (둘 다 free의 대가 — 스펙 전체에 반영):

1. **prod 자동 백업 없음** → `db-backup.yml` pg_dump가 **prod Postgres DB의 유일한 개발자 관리 백업/복구 경로**. 범위는 DB(스키마·데이터·Storage 메타데이터)까지이며 **`property-photos` Storage 실 객체(이미지 파일)는 포함되지 않는다** — Storage 객체 백업은 미도입 Accepted Risk(§11). §5-4에서 시크릿 rename으로 "prod 전용"을 이름 수준에 각인.
2. **free dev는 일정 기간 미사용 시 자동 pause** → 데이터 손실 아님, 대시보드에서 restore. 대응은 "필요할 때 깨운다" 한 줄 — keep-alive 등 우회는 오버엔지니어링이라 미도입. CI가 원격 dev에 의존하지 않는 이유이기도 함(§8).

---

## 2. dev 프로젝트 구축 (Phase A)

### 2-1. 생성 직후 체크리스트 (콘솔 — §10 manual-setup에도 포함)

1. 프로젝트 생성: `isakok-dev`, Seoul, free. DB 비밀번호는 비밀번호 관리자에만 보관.
2. **legacy JWT-based API keys 비활성 + `sb_publishable_*`/`sb_secret_*` 체계** — prod와 동일 정책(ADR-075 게이트 3 계승). 생성 시점 기본값이 무엇이든 명시적으로 확인.
3. 생성된 `<dev-ref>`를 기록 → 이후 모든 `<dev-ref>` 플레이스홀더 치환 + 가드 스크립트의 `DEV_REF` 상수(§5-2) + fingerprint 상수(§5-6).

### 2-2. 스키마·시드 (Supabase CLI **2.105.0 고정** — CI와 동일 버전)

```bash
supabase link --project-ref <dev-ref>
supabase db push --include-seed   # 마이그레이션 00001~00028 + seed.sql(마스터 체크리스트 46개)
```

- `--include-seed`는 **pending 마이그레이션이 있을 때만 seed를 실행**하는 특성(공식 이슈 트래커 확인) — 신규 dev는 28개 전부 pending이라 이 경로가 성립한다. **재시딩**(마이그레이션 변화 없이 seed만 다시)은 이 명령으로 안 되므로 psql로 `supabase/seed.sql` 직접 실행이 fallback.
- 이 명령은 **dev 전용** — prod에 seed 금지(§0-3 금지 목록).
- Storage 버킷 `property-photos`는 `00004_create_storage.sql`이 생성 → push로 자동 해결. verify에서 seed 46건 카운트 실측(§14).

### 2-3. Edge Functions 배포 (9개)

- `apple-token-exchange` / `cleanup` / `delete-account` / `generate-ai-guide` / `health` / `kakao-token-exchange` / `kakao-unlink-webhook` / `register-push-token` / `send-notifications` — **전부 배포** (아티팩트 parity 100%, §3-0).
- deploy 주의: `cleanup`은 `--no-verify-jwt` 필요(config.toml 미선언), `health`/`send-notifications`는 config.toml `verify_jwt = false` — `functions:deploy:dev` 스크립트에 인코딩(§5-2).
- Apple/Kakao 관련 함수는 배포되지만 시크릿 미투입(§9-1) → **호출 시 통제된 실패가 의도된 상태**(§3-0). verify에서 실패 응답에 내부 정보 미노출 확인(§14).

### 2-4. `ai_guide_cache` 1회 시딩 (ADR-069 역방향 부활 — secret-safe 절차)

- 문제: dev가 빈 캐시로 시작하면 dev에서 AI 가이드를 만질 때마다 Anthropic 실과금.
- 결정: **prod → dev 1회 복사**. ADR-069가 지정한 "복사 허용 유일 테이블"(공용 캐시, PII 0) — users/moves/photos 등 나머지 테이블 복사 금지 원칙 재확인.

```bash
read -s PROD_DB_URL && export PROD_DB_URL   # 대시보드에서 복사해 붙여넣기 — 히스토리·파일 미잔존
read -s DEV_DB_URL && export DEV_DB_URL
pg_dump "$PROD_DB_URL" --data-only --table=public.ai_guide_cache > /tmp/isakok-cache.sql
psql "$DEV_DB_URL" -f /tmp/isakok-cache.sql
unset PROD_DB_URL DEV_DB_URL && rm -f /tmp/isakok-cache.sql
```

- 시딩 후 검증(§14 연동): ① row count prod == dev ② PII 컬럼 없음 재확인 ③ 다른 테이블 0 copy ④ dump 파일·env 변수 잔존 0 ⑤ 캐시에 일시 상태 컬럼(생성 중 lock류)이 있으면 무결 상태로 복사됐는지 스키마 대조(구현 시 확인).
- prod DB URL 사용은 **이 1회가 유일**(§0-3 READ allowlist) — §6-4 로컬 상주 종료와 일관.

### 2-5. cron 미스케줄 + 수동 invoke 절차

- dev에는 pg_cron/pg_net 활성화·Vault secret·스케줄 **전부 미설정** — cleanup은 파괴적 작업이라 상시 실행 불필요, 푸시는 dev에 실 토큰 없음. manual-setup이 통째로 가벼워지는 부수 효과.
- 함수 검증이 필요할 때: `curl`로 직접 invoke(`CLEANUP_TOKEN`/`PUSH_CRON_TOKEN` 헤더) + `DRY_RUN=true`/`PUSH_DRY_RUN=true` 기본(§9-1).
- cron-setup.sql 변경 자체를 검증해야 할 때만 일시적으로 dev에 세팅 → 검증 후 스케줄 해제 (조건부 절차).

---

## 3. dev 인증 + parity 정의

### 3-0. dev/prod parity 층위 ("100% 동일"의 정확한 정의)

| 층위                             | parity          | 내용                                                                                                                        |
| -------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| DB 스키마 / 마이그레이션 / RLS   | **100%**        | 28개 마이그레이션 + seed 전체 적용                                                                                          |
| Edge Function 소스·배포 아티팩트 | **100%**        | 9개 전부 배포                                                                                                               |
| 외부 연동·런타임 설정            | **의도적 부분** | 익명·Google = 완전 지원 / **Apple·Kakao = 아티팩트만**(시크릿 미투입 → 통제된 실패) / cron 미스케줄 / 백업·모니터 prod 전용 |

> 이 표가 "함수 9개가 다 있는데 왜 Apple 로그인이 dev에서 실패하지?"라는 혼동을 예방한다. dev 빌드에서 Apple/Kakao 로그인 버튼의 에러는 **의도된 상태**(known limitation)이며, 해당 플로우 검증은 prod 릴리즈 채널.

### 3-1. 결정과 근거

- 기본 진입은 익명 로그인(ADR-042)이라 콘솔 작업 없이도 대부분 기능이 동작. **회원 전용 영역**(사진 게이트 ADR-074, `linkIdentity` 승격, 계정 삭제)이 분리 트리거 4번("위험한 변경을 dev에서 먼저")과 가장 관련 깊은 영역 → **콘솔 작업이 가장 가벼운 Google 1개만 열어** dev에서 회원 상태를 만들 수 있게 한다.

### 3-2. 세팅 목록 (§10 manual-setup)

1. dev Supabase Auth: **익명 로그인 ON** / Site URL = `https://isakok-dev.vercel.app` / Redirect URLs = 위 + `http://localhost:5173`. **PR Preview ephemeral URL 와일드카드는 미등록**(§4-2 역할 분리 — OAuth는 isakok-dev에서만 보장).
2. dev Supabase Google provider: 기존 클라이언트 ID 3종(`EXPO_PUBLIC_GOOGLE_*`) 재사용 등록 + **Skip nonce checks ON**(ADR-052 동일).
3. Google Cloud 콘솔 web client: Authorized redirect URIs에 `https://<dev-ref>.supabase.co/auth/v1/callback` **한 줄 추가** (prod 항목 유지). Apple/Kakao 콘솔 작업 **없음**.

---

## 4. 채널-환경 매핑 (Phase C — 이 스펙의 몸통)

### 4-1. 매핑 표 + 페어링 불변식

**불변식** (10-3 실측 근거): 네이티브 빌드의 Supabase(`EXPO_PUBLIC_*`)와 그 빌드의 `EXPO_PUBLIC_WEB_APP_URL`이 가리키는 웹 배포의 Supabase(`VITE_*`)는 **반드시 같은 프로젝트**여야 한다. 다르면 세션 브릿지 `setSession()` 후 `getUser()` 실패. `VITE_*`/`EXPO_PUBLIC_*`는 빌드타임 인라인이라 런타임 스위칭 불가 → 아래 표가 곧 설계이며, 웹 측은 §5-6 fingerprint가 잘못된 조합을 startup에서 차단한다.

| 빌드 채널                                     | Supabase | 페어링되는 웹                       | 비고                                                                  |
| --------------------------------------------- | -------- | ----------------------------------- | --------------------------------------------------------------------- |
| EAS `development`                             | **dev**  | localhost/LAN (로컬 웹 = dev, §5-3) | WEB_APP_URL은 로컬 `.env` 유지(머신별 LAN IP). LAN origin CORS는 §5-1 |
| EAS `preview`                                 | **dev**  | `https://isakok-dev.vercel.app`     | 빌드 전 dev 웹 publish 절차(§4-2)                                     |
| EAS `production`                              | **prod** | `https://isakok.vercel.app`         | **무변경** (ADR-070 유지)                                             |
| Vercel Production (main)                      | **prod** | —                                   | 무변경                                                                |
| Vercel Preview (PR 브랜치)                    | **dev**  | —                                   | UI/기본 검증 전용(§4-2 역할 분리)                                     |
| Vercel `dev` 브랜치 → `isakok-dev.vercel.app` | **dev**  | —                                   | **완전한 dev 통합 검증 환경**                                         |

### 4-2. Vercel — 단일 프로젝트 + dev 미러 브랜치

- 별도 Vercel 프로젝트를 만들지 않는다 — main 푸시마다 빌드 2배(Hobby 동시 빌드 1개 큐) + 설정 이중 관리 회피.
- **`dev` 브랜치 = deployment mirror** (일반 개발 브랜치가 아님): main의 특정 스냅샷을 dev 웹으로 승격하는 **포인터**. **직접 커밋 금지**, 갱신은 오직 `git push origin main:dev`(= "dev 웹 publish" 연산). GitFlow식 장기 브랜치로 오해 금지 — 문서·ADR-108에 명시.
- 설정 3가지:
  1. 기존 `isakok` 프로젝트 **Preview 환경변수 → dev Supabase** (`VITE_SUPABASE_URL`/`ANON_KEY`=dev, `VITE_APP_ENV=development`). 관측 키(Sentry/PostHog)는 기존 값 유지 — dev 이벤트는 `environment=development` 태그로 분리되어 prod 알림·지표에서 필터됨(ADR-088). production 전용 게이트는 RUM(`web_vitals`, ADR-102)뿐이라 dev에서 RUM만 미수집.
  2. `dev` 브랜치 생성 + 프로젝트 도메인 `isakok-dev.vercel.app` 추가 → **dev 브랜치에 할당**.
  3. ⚠️ 확인(구현): `isakok-dev.vercel.app`이 현재 어디에 붙어 있는지(옛 alias 잔재 여부) → 회수 후 재할당.
- **dev 웹 publish 절차 (EAS preview 빌드 전 순서 고정)**:
  1. `git push origin main:dev`
  2. Vercel 배포 완료 + `isakok-dev.vercel.app` 접속(커밋 SHA/버전 일치 확인)
  3. DEV 배지 표시 + dev Supabase 연결 확인
  4. **그 후에** EAS preview 빌드 → 세션 브릿지 검증
- **역할 분리 (PR Preview vs dev 도메인)**:
  - PR Preview(ephemeral URL) = **UI·익명 플로우·DB 기본 검증**. Google OAuth redirect·Edge Function CORS는 **미보장이 정책** — Auth Redirect 와일드카드 미등록(§3-2), CORS exact-match 유지(§5-1). Edge 호출 403이 정상.
  - `isakok-dev.vercel.app` = **완전한 통합 검증 환경** — OAuth·Edge Function·세션 브릿지 전부 여기서.

### 4-3. eas.json + EAS 환경변수

- `eas.json`: development/preview 프로필의 `"environment": "production"` → 각각 `"development"`/`"preview"`로 전환. **production 프로필 무변경**.
- EAS 환경변수(development·preview 스코프): `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` = dev, `EXPO_PUBLIC_WEB_APP_URL` = (preview) `https://isakok-dev.vercel.app`. development의 WEB_APP_URL은 로컬 `.env`(LAN IP) 관행 유지.
- `EXPO_PUBLIC_GOOGLE_*` 3종은 dev/prod 공용(앱에 묶인 값) — 전 스코프 동일.
- 순서(§0-3 Phase C): **EAS env 등록 → eas.json 머지** — 역순이면 다음 development/preview 빌드가 빈 env로 깨짐.

### 4-4. DEV 배지 (사람용 사고 방지 UI)

- dev 채널 웹 화면 구석에 고정 "DEV" 배지 — "지금 어느 환경인가"를 눈으로 구분해 "prod인 줄 모르고 조작" 사고 차단.
- 구현: 기존 `observability/env.ts`의 **`getEnv()` 재사용** — `getEnv() !== 'production'`이면 표시(새 판정 로직 0, 단일 출처 유지). getEnv의 fallback은 `development`(11단계 Codex P2 수정)라 prod에 `VITE_APP_ENV` 미주입 시 배지가 뜨는데, 이는 **미설정을 드러내는 시끄러운 실패**로 의도에 부합(ref 조합 오류는 §5-6이 별도 차단). `.env.test`(`VITE_APP_ENV=test`)도 fallback으로 development 판정 → E2E에서 배지 표시되나 non-interactive라 무해.
- `pointer-events: none` + `aria-hidden` → E2E 셀렉터·axe 게이트 영향 0.
- 배지는 **사람용**이고 코드 강제는 §5-6 fingerprint — 역할 분담.

---

## 5. 코드/레포 변경 (Phase B)

### 5-1. cors `ALLOWED_ORIGINS` env화 (fail-closed, 합집합 규칙)

- `supabase/functions/_shared/cors.ts:1`의 하드코딩 배열 → **함수 시크릿 `ALLOWED_ORIGINS`(콤마 구분) 파싱**. 코드 변경은 이 한 곳.
- **판정 의미론 (명시)**:

```
allowed = parse(ALLOWED_ORIGINS)                        # 미설정 → 빈 목록
if ENVIRONMENT === 'development': allowed += 로컬 개발 origin   # 합집합
origin ∈ allowed → 허용, 아니면 403 (Vary: Origin)
```

- fail-closed의 의미 = "**어떤 origin도 묵시적 `*`로 허용하지 않는다**"이지 "dev 로컬 fallback까지 꺼진다"가 아님. 시크릿 미설정 + `ENVIRONMENT=production`이면 전면 403(ADR-064 정신).
- **LAN origin**: 네이티브 development 빌드의 WebView는 `http://192.168.x.x:5173`을 열므로 Origin이 localhost가 **아니다**. dev `ALLOWED_ORIGINS`에 개발 머신 LAN origin을 명시 추가(§9-1) — RFC1918 대역 자동 허용은 코드 복잡도 대비 이득 없어 미채택, LAN IP 변경(DHCP) 시 시크릿 1줄 갱신을 수용. ⚠️ 확인(구현): 기존 development 게이트가 실제 무엇을 허용하는지 실측 — LAN까지 이미 커버하면 시크릿 등재는 생략 가능.
- 값: dev = `isakok-dev.vercel.app` + 로컬/LAN(§9-1) / **prod = `https://isakok.vercel.app` 단독** — localhost·LAN·isakok-dev 전부 403(기존 하드코딩의 "prod가 dev origin 허용" 어색함 해소).
- ⚠️ **배포 순서 경고 (prod 장애 방지)**: fail-closed이므로 **prod에 시크릿을 먼저 설정한 뒤** 새 cors.ts를 재배포. 역순이면 prod Edge Function CORS 전면 차단 = 장애. dev에 먼저 배포·검증 후 Phase D 순서대로(§6).

### 5-2. 배포·리셋 스크립트 — 명령 분리 + ref 가드 (P0-1·P0-2)

**원칙 3줄** (ADR-109에 기록):

1. **linked 상태는 편의일 뿐 안전 경계가 아니다** — 파괴적/원격 명령은 스크립트가 대상 ref를 코드 상수(`DEV_REF`/`PROD_REF`)와 대조해 검증한다. 사용자 기억·확인 프롬프트에 안전을 맡기지 않는다.
2. **prod는 link하지 않는다** — 로컬 기본 linked = dev 고정. prod 작업은 `--project-ref <PROD_REF>`(functions) / 일시적 `--db-url`(db, read -s 주입) 명시 실행으로 link 변경 자체를 회피.
3. **prod에는 통합 명령이 없다** — DB와 함수를 의도적으로 별도 실행. 함수 핫픽스 목적의 명령이 대기 중 마이그레이션을 prod에 끌고 가는 사고를 구조적으로 차단.

| 명령                                       | 동작                                              | 가드                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:push:dev`                         | dev에 마이그레이션 push                           | linked ref ≠ `DEV_REF` → 즉시 exit 1                                                                                                          |
| `pnpm functions:deploy:dev`                | 함수 9개 deploy(`cleanup --no-verify-jwt` 인코딩) | 동일                                                                                                                                          |
| `pnpm deploy:dev`                          | 위 둘 합성 — **dev 전용 편의 명령**               | 동일                                                                                                                                          |
| `pnpm db:reset:dev`                        | dev 원격 리셋 + seed (dev-wipe 대체)              | ref ≠ `DEV_REF` → exit 1 / ref = `PROD_REF` → **무조건 exit 1**. `supabase db reset --linked` **직접 실행 금지**(문서·스크립트 주석에 명문화) |
| `pnpm functions:deploy:prod -- <PROD_REF>` | **함수만** deploy — DB 미접촉                     | 타이핑한 ref = 기대 `PROD_REF` 검증(불일치 exit 1). 인자 없으면 거부                                                                          |
| `pnpm db:push:prod -- <PROD_REF>`          | (이번 스펙 **사용처 없음** — 향후 단계용)         | ref 타이핑 검증 + `supabase db push --dry-run`으로 적용 예정 마이그레이션 표시 + 명시적 확인 후 실행                                          |

- CD 미도입 근거(ADR 기록용): 팀이면 GitOps가 정석이나, 1인 + free pause 소음 + `SUPABASE_ACCESS_TOKEN`/DB 비밀번호의 GitHub 시크릿 표면 확대가 이득을 상회. 재검토 트리거 = 협업자 발생.
- ⚠️ 미결(구현): linked ref 판독 경로(`supabase/.temp/project-ref`)와 `db push`의 원격 지정 방식(linked vs `--db-url`)을 CLI 2.105.0에서 실측 후 스크립트 확정.

### 5-3. .env 정리 (역할 분리)

| 파일                  | 분리 후 역할                                                                         |
| --------------------- | ------------------------------------------------------------------------------------ |
| `apps/web/.env.local` | 웹 클라이언트 `VITE_*` = **dev** (일상 개발 = 원격 dev 직결)                         |
| 루트 `.env.local`     | 스크립트 전용(`SUPABASE_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY` = **dev**) — rls-smoke 등 |
| `apps/mobile/.env`    | `EXPO_PUBLIC_*` = **dev** + LAN `WEB_APP_URL`                                        |
| `.env.example` 2곳    | dev/prod 구분 안내로 갱신 ("로컬은 항상 dev" 명시)                                   |

- 현재 루트/apps/web `.env.local` **중복** 해소 — 무엇이 루트 것을 읽는지 구현 시 grep 확인 후 위 역할로 정리.
- **prod 키는 어느 로컬 파일에도 없음**(§6-4). `.claude/settings.local.json`: 기존 ref + 인라인 legacy JWT 키(이미 비활성) 제거.

### 5-4. `db-backup.yml` — prod 전용 각인

- GitHub Secret `SUPABASE_DB_URL` → **`SUPABASE_PROD_DB_URL`** rename + 워크플로 참조 갱신 + 헤더에 "prod **Postgres DB** 전용 · 유일한 DB 백업(free tier 자동 백업 없음) · Storage 실 객체 미포함(§11 Accepted Risk)" 주석.
- rename 직후 `workflow_dispatch` 1회 그린 + **아티팩트 restore 테스트 수동 1회**(§14 — "성공한 backup job ≠ 복구 가능한 백업").

### 5-5. cron-setup.sql 주석

- `supabase/functions/{cleanup,send-notifications}/cron-setup.sql` 헤더에 "**prod 전용 — dev 미스케줄(스펙 14 §2-5), dev 검증은 수동 invoke**" 주석. 파일 유지(조건부 절차용).

### 5-6. 환경 fingerprint 검증 (웹 startup — P2-1 부분 채택)

- DEV 배지는 사람용 — "배지는 DEV인데 실제로는 prod ref를 바라보는 잘못된 빌드"는 못 잡는다. 웹 startup에서 env×ref 조합을 코드로 검증:
  - `VITE_SUPABASE_URL`이 `*.supabase.co` 패턴일 때만 ref 추출 — 로컬 스택(`127.0.0.1:54321`)은 검증 제외라 E2E·로컬 Docker 무영향.
  - `getEnv() === 'production'` && ref ≠ `PROD_REF` → **throw** (조용히 dev 데이터에 쓰는 production 빌드 차단).
  - ref = `PROD_REF` && `getEnv() !== 'production'` → **throw** (dev/preview가 prod를 조용히 바라보는 최악 조합 차단).
- 유닛 테스트로 조합 고정(13단계 Vitest 셋업 재사용). `PROD_REF`는 공개 식별자 성격(클라이언트 URL에 이미 인라인)이라 상수 하드코딩 무방 — secret과 혼동 금지.
- **미도입(트림)**: 네이티브 측·빌드타임 검증 — 브릿지 페어링 불일치는 이미 `setSession()`→`getUser()`에서 시끄럽게 실패(10-3 실측), EAS env는 스코프 고정이라 표면 작음. 웹이 데이터 레이어라 웹 검증이 실질 커버.

---

## 6. prod 하드닝 (Phase D — prod 접촉의 유일 예외, 순서 엄격)

dev=prod 시절 어쩔 수 없이 prod에 열려 있던 dev 편의를 제거한다. **이 Phase에서 prod `db push`는 금지**(§0-3) — 배포는 `functions:deploy:prod`만.

1. **시크릿 선설정**: prod 함수 시크릿 `ALLOWED_ORIGINS=https://isakok.vercel.app` + `ENVIRONMENT=production`(현재 값 확인 후 교정 — localhost CORS 게이트 OFF 확정).
2. **함수만 재배포**: `pnpm functions:deploy:prod -- <PROD_REF>` — 1번이 먼저여야 함(fail-closed 장애 방지, §5-1).
3. **CORS 스모크**: prod에서 isakok.vercel.app 허용 / localhost·LAN·isakok-dev·무작위 origin 403.
4. **콘솔 잔재 제거**: Supabase Auth Redirect URLs의 localhost 항목 제거(존재 시). Site URL·prod redirect 유지.
5. **prod secret 키 로컬 상주 종료**: 로컬 `.env`엔 dev 키만(§5-3). prod `sb_secret_*`/DB URL은 GitHub Secret(백업)과 대시보드에만 — 드물게 필요하면 대시보드에서 꺼내 read -s로 쓰고 파일 저장 금지. §2-4 dump가 마지막 사용.
6. 대시보드 rename `isakok-prod`(§1) — 이름만, ref/URL 불변.
7. GitHub 시크릿 rename + dispatch + restore 테스트(§5-4).

---

## 7. dev=prod 잔재 전수 처분표

"분리 안 하려고 했던 것들"의 원상복구 필요 여부 전수 체크 결과. ADR-075 당시 작업 대부분은 분리 회피용 꼼수가 아니라 **dev→prod 하드닝**이었으므로 prod가 prod인 한 계속 유효 — 원복 대상은 소수다.

| 항목 (ADR-075 전후 산물)                            | 처분                                        | 근거/위치                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `db-backup.yml` pg_dump                             | **유지** (+rename, 범위 명확화)             | prod 하드닝. prod **DB**의 유일한 백업 [§5-4·§11]                                                                                              |
| legacy JWT 비활성 + `sb_*` 체계                     | **유지** + dev에도 동일 적용                | 하드닝 [§2-1]                                                                                                                                  |
| kakao/delete-account 에러 트리밍                    | **유지**                                    | 하드닝 (ADR-075 게이트 4)                                                                                                                      |
| gitleaks 스캔·키 rotation 결과                      | **유지**                                    | 하드닝 (게이트 3·5)                                                                                                                            |
| OAuth 콘솔 prod URL 등록                            | **유지**                                    | prod가 prod인 한 유효 (게이트 6)                                                                                                               |
| `dev-wipe.sql` 삭제 (게이트 1)                      | **미복구** — 가드 wrapper로 대체            | dev 리셋은 `pnpm db:reset:dev`(DEV_REF 코드 검증)로만. `supabase db reset --linked` **직접 실행 금지** — linked 상태는 안전 경계가 아님 [§5-2] |
| eas.json 3프로필 전부 production                    | **전환**                                    | dev=prod 워크어라운드였음 [§4-3]                                                                                                               |
| rls-ci.yml "임시 로컬 스택" 주석 + ADR-099          | **승격** (코드 유지, 명분 "임시"→"정식")    | 분리 후에도 로컬 격리가 옳았음이 확인된 케이스 [§8]                                                                                            |
| prod의 localhost 허용 (`ENVIRONMENT`·Auth Redirect) | **제거**                                    | dev 편의의 prod 잔류 [§6]                                                                                                                      |
| cors 하드코딩에 isakok-dev 포함                     | **제거** (env화로 prod에서 배제)            | [§5-1]                                                                                                                                         |
| ADR-069 캐시 복사 (dev→prod, 무의미화됐던 것)       | **역방향 부활** (prod→dev 1회, secret-safe) | [§2-4]                                                                                                                                         |
| ADR-068(Seoul)·069·075 체인                         | 대체/후속 **주석**                          | [§13]                                                                                                                                          |
| 문서·주석의 "dev=prod" 전제                         | **sweep**                                   | 살아있는 문서(CLAUDE.md·STATUS·워크플로 헤더·코드 주석)만 갱신, 과거 스펙은 당시 기록이라 불변 [§14]                                           |

---

## 8. CI/CD — 변경 없음의 명시

원칙: **CI는 일회용 로컬 스택으로 결정적으로, 원격 dev는 사람의 개발 루프 전용.** free dev는 자동 pause되므로 CI가 원격 dev에 의존하는 순간 랜덤 실패 소음원이 된다 (+네트워크 의존, 공유 상태 오염, PR 동시 실행 간섭, admin 시크릿 추가, 지연 증가).

- `ci.yml`(verify/e2e) — **무변경**. 더미 env + 로컬 Docker 스택(13단계)이라 분리의 영향권 밖.
- `rls-ci.yml` — **코드 무변경, 주석만 승격**: "dev=prod라 임시로 로컬 스택" → "결정성·격리를 위한 정식 선택". 원격 dev의 RLS 실측은 verify에서 **수동 1회**(§14) + 이후 필요 시.
- `db-backup.yml` — §5-4 rename만.
- dev 자동 배포 — 미도입(§5-2 원칙 + 재검토 트리거). "왜 안 바꿨는지"를 각 워크플로 헤더 주석 한 줄로.

---

## 9. 환경 변수 / 시크릿 인벤토리

> **키 명명 주의 (P1-9)**: `*_ANON_KEY`/`*_SERVICE_ROLE_KEY` 변수명은 기존 코드 호환을 위해 유지하지만, **실제 값은 legacy JWT가 아니라 `sb_publishable_*`(ANON 계열) / `sb_secret_*`(SERVICE_ROLE 계열)** 이다(ADR-075 게이트 3에서 이미 이 방식으로 전환된 전례). legacy JWT 재사용을 의미하지 않는다. 변수명 자체의 rename은 코드 변경 범위 확대라 이번 범위 밖(§0-2).

### 9-1. dev Supabase 함수 시크릿 (전부 신규 — prod 값 재사용 금지)

| 시크릿                                                  | dev 값                                                                                           | 비고                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                                     | **dev 전용 신규 키**                                                                             | 콘솔 spend limit 설정(§11) — 비용 분리 집계 + 개별 rotate                                            |
| `ANTHROPIC_MODEL`                                       | prod와 동일 값                                                                                   | 값 자체는 비밀 아님                                                                                  |
| `RATE_LIMIT_SALT` / `CLEANUP_TOKEN` / `PUSH_CRON_TOKEN` | 신규 랜덤                                                                                        | 한쪽 유출이 다른 쪽에 무영향                                                                         |
| `DRY_RUN` / `PUSH_DRY_RUN`                              | **`true` 기본**                                                                                  | 수동 invoke 검증 시 안전 기본값 [§2-5]                                                               |
| `ENVIRONMENT`                                           | `development`                                                                                    | 로컬 origin 합집합 게이트 ON [§5-1]                                                                  |
| `ALLOWED_ORIGINS`                                       | `https://isakok-dev.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://<LAN-IP>:5173` | LAN origin은 개발 머신 실측값 — 기존 development 게이트가 LAN까지 커버하면 생략 가능(§5-1 구현 확인) |
| `APPLE_*` / `KAKAO_*`                                   | **미투입**                                                                                       | 아티팩트만 parity(§3-0) — 호출 시 통제된 실패가 의도된 상태                                          |

### 9-2. prod Supabase 함수 시크릿 (Phase D 추가/교정분만)

| 시크릿            | prod 값                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| `ALLOWED_ORIGINS` | `https://isakok.vercel.app` (신규 — localhost·LAN·isakok-dev **전부 미포함**) |
| `ENVIRONMENT`     | `production` (현재 값 확인 후 교정)                                           |

### 9-3. 빌드 채널 env

| 위치                    | 변수                                       | 값                                                                                                                                                                         |
| ----------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel Production       | 전체                                       | **무변경** (`VITE_APP_ENV=production` 명시 주입 상태 확인 — 11단계 verify에서 주입 완료 기록)                                                                              |
| Vercel Preview          | `VITE_SUPABASE_URL`/`ANON_KEY`             | dev                                                                                                                                                                        |
| Vercel Preview          | `VITE_APP_ENV`                             | `development` — 관측 이벤트는 `environment=development` **태그로 분리**(ADR-088, prod 알림·지표 필터), RUM만 production 전용 게이트로 미수집(ADR-102). DEV 배지 표시(§4-4) |
| EAS development·preview | `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY`      | dev                                                                                                                                                                        |
| EAS preview             | `EXPO_PUBLIC_WEB_APP_URL`                  | `https://isakok-dev.vercel.app`                                                                                                                                            |
| EAS production          | 전체                                       | **무변경**                                                                                                                                                                 |
| GitHub Secrets          | `SUPABASE_DB_URL` → `SUPABASE_PROD_DB_URL` | rename [§5-4]                                                                                                                                                              |
| 로컬 3파일              | §5-3 표                                    | 전부 dev — prod 키 로컬 상주 종료                                                                                                                                          |

---

## 10. manual-setup (콘솔 — 코드 아님)

1. **Supabase**: `isakok-dev` 생성(Seoul·free) → legacy JWT off + `sb_*` 키 확인 → 기존 프로젝트 rename `isakok-prod` → dev Auth(익명 ON, Site/Redirect URL §3-2 — PR Preview 와일드카드 미등록) → dev Google provider(클라이언트 ID 3종 + Skip nonce ON) → dev 함수 시크릿(§9-1) → prod 함수 시크릿(§9-2, **Phase D 순서 준수**) → prod Auth Redirect localhost 제거.
2. **Google Cloud**: web client Authorized redirect URIs에 dev callback 추가(§3-2). Apple/Kakao 콘솔 작업 **없음**.
3. **Vercel**: Preview 환경변수 전환 → `isakok-dev.vercel.app` 도메인 소재 확인·회수 → dev 미러 브랜치에 할당(§4-2).
4. **EAS**: development/preview 스코프 환경변수 등록(§4-3) — **eas.json 머지 전에**.
5. **GitHub**: `SUPABASE_PROD_DB_URL` 시크릿 생성(기존 값 이전) → 구 시크릿 삭제 → 백업 workflow_dispatch 1회 → 아티팩트 restore 테스트(§14).
6. **Anthropic 콘솔**: dev 키 발급 + spend limit 설정.
7. **UptimeRobot**: 무변경 확인만(prod `/functions/v1/health` 유지, dev 모니터 미추가 — pause 거짓 알람 방지).

> 신규 외부 서비스 가입 없음. Supabase 프로젝트 1개 + 기존 콘솔들의 항목 추가/정리가 전부.

---

## 11. 보안 / 개인정보 / Accepted Risk

- **분리 자체가 이번 단계 최대의 보안 개선** — 일상 개발·PR 프리뷰·실험이 실사용자 데이터에서 물리적으로 분리.
- **dev 더미 데이터 원칙**: dev 테스트에 실제 주소·연락처를 입력하지 않는다(이사앱 특성상 접근 제한보다 실효 큼). dev 배포 접근 제한은 미도입(§0-2).
- **시크릿 격벽**: dev 시크릿 전부 신규(§9-1). Anthropic dev 키 spend limit로 비용 폭주 이중 방어(공개 인터넷에서 호출 가능한 dev 함수 + 느슨한 감시 전제).
- **prod 관리자 키 로컬 상주 종료**(§6-5) — 로컬 파일에 실DB 관리자 키가 상시 있었던 상태가 끝남.
- **Accepted Risk — Storage 실 객체 백업 미도입 (P0-3)**: `property-photos`의 이미지 객체는 pg_dump 범위 밖이며 별도 백업이 없다. 이번 단계는 환경 분리로 범위를 유지한다. **재검토 트리거**: ① 외부 사용자 사진 업로드 본격 증가 ② 사진이 보증금 분쟁 증빙으로 실사용되기 시작 ③ 유료 사용자 발생 ④ Supabase Pro 전환 검토 시점 — 도달 시 Storage 백업 전략(객체 미러링 등) 별도 설계.
- **약관/개인정보처리방침 변경 없음**: dev에 실사용자 데이터 없음(더미 원칙) + 신규 수탁자 없음. 관측 environment 태그는 ADR-088 그대로 — 범위 밖.

---

## 12. 브리핑 열린 질문 → 결정 매핑

| Q   | 질문               | 결정                                                                      |
| --- | ------------------ | ------------------------------------------------------------------------- |
| 1   | 분리 방향          | 기존=prod / 신규=dev [§1]                                                 |
| 2   | 요금제/리전/이름   | 둘 다 free(슬롯 확보) / Seoul / isakok-prod·isakok-dev [§1]               |
| 3   | dev 인증 범위      | 익명 + Google (Apple/Kakao는 아티팩트만) [§3]                             |
| 4   | rls-ci 대상        | 로컬 스택 유지(정식 승격) + dev 실측은 verify 수동 1회 [§8]               |
| 5   | dev 자동 배포 CI   | 미도입 → 가드 스크립트(명령 분리) [§5-2]                                  |
| 6   | EAS 매핑           | development·preview→dev / production→prod(무변경) [§4-3]                  |
| 7   | Vercel 매핑        | 단일 프로젝트: Preview→dev + dev 미러 브랜치에 isakok-dev 도메인 [§4-2]   |
| 8   | cors 하드코딩      | env화, fail-closed(합집합 규칙) [§5-1]                                    |
| 9   | dev cron           | 미스케줄, 수동 invoke + DRY_RUN [§2-5]                                    |
| 10  | 로컬 개발 기본값   | 원격 dev 직결 (E2E/CI만 로컬 스택) [§5-3]                                 |
| 11  | db-backup dev 포함 | prod 전용 + rename + 범위 명확화(DB 한정) [§5-4·§11]                      |
| 12  | 관측 태그          | 범위 밖 명시 (ADR-088 유지 — dev는 태그 분리, RUM만 prod 전용) [§9-3·§11] |

---

## 13. ADR (`docs/ADR.md` 반영용)

> ⚠️ ADR 번호: 설계 시점 max = **105**. 작성 직전 `docs/ADR.md` 최대번호 재확인 후 +1부터(STATUS 학습 §146). 아래는 **106 가정**.
> **정본 위치 (P1-4)**: ADR 정본은 `docs/ADR.md` 단일(DECISIONS.md는 기획 스냅샷 — §14에서 ADR.md 이관 명시, 2026-06-05). 과거 스펙의 "DECISIONS.md 복붙용" 헤더는 관례 오기였으므로 이 스펙부터 교정.
> 체인 정리 동시 수행: ADR-075에 "⚠️ ADR-106으로 대체(분리 실행)" / ADR-068에 "신규 dev도 Seoul(ADR-106)" / ADR-069에 "분리 후 역방향(prod→dev) 1회 시딩 부활(ADR-107)" / ADR-099에 "ADR-109로 정식 승격" 주석.

### ADR-106: dev/prod 분리 실행 — 기존=prod, 신규=dev, 둘 다 free (ADR-075 대체)

- 결정: free 슬롯 확보로 분리 가능해짐에 따라 dev/prod를 분리. 기존 `ybcqinanfcarhqkclvue`(실데이터 보유)=prod 유지(rename isakok-prod), 신규 isakok-dev 생성. 둘 다 free, Seoul.
- 배경: ADR-075의 분리 트리거 4개(폐쇄 테스트/DB 50%/MAU 1000+/위험한 변경) 중 **어느 것도 도달 전** — 슬롯이 확보되자 부채를 조기 상환.
- 대안: (A) 역방향(신규=prod) — 실데이터 dump/restore + Apple/Kakao/Google/Auth/UptimeRobot 등 prod ref가 박힌 외부 설정 전면 변경 + Storage 이전, 이득 0 → 기각. (B) prod만 Pro — 자동 백업 등 이점 있으나 수익화 전 고정비 → 보류(트리거: 매출 발생 또는 pg_dump/Storage 백업 한계 체감).
- free 대가 수용: ① prod 백업 = pg_dump가 **Postgres DB의** 유일한 개발자 관리 경로(`SUPABASE_PROD_DB_URL`로 각인) — **Storage 실 객체(property-photos)는 미백업 Accepted Risk**(재검토 트리거: 사진 실사용·유료화·Pro 전환) ② dev 자동 pause(수동 restore로 수용, keep-alive 미도입).
- 트레이드오프: 비용 0 유지 vs Pro 편의 부재. 1인·출시 초기 규모에 적정.

### ADR-107: dev parity 층위 — DB·함수 아티팩트 100% / 외부 연동 의도적 부분

- 결정: dev는 **DB 스키마·마이그레이션·RLS·Edge Function 소스/배포 아티팩트 parity 100%**(마이그레이션 28 + seed + 함수 9). **외부 연동·런타임 설정은 의도적 부분 parity** — 익명·Google 완전 지원 / Apple·Kakao는 아티팩트만(시크릿 미투입, 호출 시 통제된 실패) / cron 미스케줄(수동 invoke+DRY_RUN) / 백업·UptimeRobot prod 전용 / 시크릿 전부 신규(Anthropic dev 키+spend limit). `ai_guide_cache`만 prod→dev 1회 시딩(ADR-069 허용 테이블 역방향, secret-safe 절차, 나머지 테이블 복사 금지 재확인).
- 이유: parity의 목적은 "dev 검증 = prod 동작 보장"이며 이는 스키마·RLS·함수 레이어에서 성립. 소셜 풀세팅·cron·모니터링은 콘솔 작업량·상시 소음 대비 검증 가치가 낮음(Apple/Kakao 고유 플로우는 prod 릴리즈 채널 검증 유지). Google 1개는 회원 전용 영역(사진 게이트·linkIdentity·계정 삭제)의 dev 재현을 위한 최소 구성. 층위를 명시해 "함수는 다 있는데 왜 Apple이 실패하지" 혼동을 예방.
- 대안: 익명/이메일만(회원 플로우 dev 재현 불가 — 분리 효과 반감), 소셜 풀세팅(콘솔 작업 과다) — 미채택.

### ADR-108: 채널-환경 매핑 — Vercel 단일 프로젝트 + dev 미러 브랜치, EAS dev/preview→dev

- 결정: 빌드 채널별 Supabase 매핑을 표로 고정(스펙 14 §4-1). Vercel은 단일 프로젝트에서 Preview env=dev + **`dev` 브랜치(= deployment mirror, 직접 커밋 금지)**에 `isakok-dev.vercel.app` 할당 — 갱신은 `git push origin main:dev`(publish 연산)뿐. EAS development/preview→dev, production 무변경(ADR-070 유지). **역할 분리**: PR Preview = UI/기본 검증(OAuth·Edge 미보장이 정책) / isakok-dev.vercel.app = 완전한 통합 검증 환경(OAuth·Edge·세션 브릿지).
- 이유: `VITE_*`/`EXPO_PUBLIC_*` 빌드타임 인라인 → 배포=환경. 세션 브릿지 불변식(네이티브 Supabase = 페어링 웹의 Supabase) 때문에 preview 네이티브의 고정 짝인 안정적 dev 웹 URL이 필수. dev 웹이 실제 필요한 순간은 preview 네이티브 테스트 시뿐이라 상시 동기화 불필요 — 별도 Vercel 프로젝트(빌드 2배·Hobby 큐·설정 이중화)보다 관리 표면 최소. 미러 선언으로 GitFlow 오해 차단.
- 부가: DEV 배지(`getEnv()` 재사용, 사람용) + 웹 startup fingerprint(코드 강제 — production×dev-ref, 비production×prod-ref 조합 throw, 로컬 스택 URL 제외).
- 대안: 별도 Vercel 프로젝트, dev 브랜치 상시 동기화, PR Preview에 OAuth 와일드카드(redirect 표면 확대) — 미채택.

### ADR-109: prod 안전 계층 — CORS env화(fail-closed) + 명령 분리·ref 가드 + CI 로컬 스택 정식화

- 결정: ① `ALLOWED_ORIGINS` 하드코딩 → 프로젝트별 함수 시크릿. **합집합 규칙**: 시크릿 목록 + (`ENVIRONMENT=development`일 때만) 로컬/LAN origin. 미설정 시 묵시적 `*` 없음 = 전면 403(fail-closed, ADR-064 정신). prod=isakok.vercel.app 단독. ② **배포·리셋 스크립트 원칙**: linked 상태는 안전 경계가 아님(모든 파괴적 명령은 DEV_REF/PROD_REF 코드 대조) / prod는 link하지 않음(`--project-ref`/일시 `--db-url` 명시 실행) / **prod 통합 deploy 명령 없음**(DB push와 함수 배포 분리 — 함수 핫픽스가 대기 마이그레이션을 끌고 가는 사고 차단) / `supabase db reset --linked` 직접 실행 금지 → `db:reset:dev` wrapper(PROD_REF 무조건 거부) / `db:push:prod`는 ref 타이핑+dry-run 필수. ③ rls-ci/E2E 로컬 스택을 "임시"→"정식"으로 승격(ADR-099 승격) — free dev pause가 원격 의존 CI를 소음원으로 만듦.
- 이유: fail-closed는 시크릿 누락이 조용한 전면 허용으로 퇴화하는 것을 방지(prod 배포 시 시크릿 선설정 순서 필수 — 스펙 §6). 가드는 dev-wipe project-ref 가드 패턴의 계승 — prod 오발사를 기억이 아닌 코드로 차단. CD 미도입은 1인+free 환경에서 시크릿 표면·pause 소음이 이득을 상회 — 재검토 트리거: 협업자 발생.
- 대안: dev CORS `*.vercel.app` suffix 허용(PR 프리뷰 편의 < 코드 복잡도 — isakok-dev로 대체), RFC1918 자동 허용(동일), rls-ci dev 실 DB(pause 소음·시크릿·PR 간섭), CI 자동 배포, prod 통합 deploy 명령 — 미채택.

---

## 14. Verify 골격 (구현 후 `14-env-separation-verify.md` 대조 기준)

1. **채널 페어링 실측**: §4-1 표의 각 행에서 로그인→데이터 조회 성공. 특히 EAS preview ↔ isakok-dev.vercel.app 세션 브릿지(`setSession()`→`getUser()`) — 불변식 실측.
2. **prod 접촉 allowlist 준수**: §0-3 허용 목록 외 prod 변경 0 — 데이터·스키마 diff 없음. **`functions:deploy:prod` 실행 과정에서 DB 마이그레이션이 실행되지 않았음** 확인(마이그레이션 히스토리 불변).
3. **가드 동작**: `db:reset:dev` — PROD_REF·unknown ref 거부, DEV_REF만 허용 / `functions:deploy:prod` — ref 인자 없거나 불일치 시 거부 / `db:push:prod` — dry-run이 적용 예정 마이그레이션 표시 / `deploy:dev` — prod link 상태에서 중단.
4. **CORS 매트릭스**: dev — localhost·LAN·isakok-dev 허용 / prod — isakok.vercel.app만 허용, localhost·LAN·isakok-dev·무작위 origin 403 / 시크릿 미설정 상태 fail-closed 동작(dev에서 실측).
5. **dev 구축 parity**: 마이그레이션 28개 적용 / seed 46건 / 함수 9개 존재 / **dev 대상 RLS 스모크 16/16 수동 1회** / `ai_guide_cache` row count prod==dev(+일시 상태 컬럼 무결).
6. **외부 연동 기대 상태**: 익명 진입 + Google 로그인 + `linkIdentity` 승격 + 사진 게이트 + 계정 삭제 — 회원 전용 영역 dev 완주 / Apple·Kakao — dev 시크릿 **미존재** 확인 + 호출 시 통제된 실패 + 응답에 시크릿/내부 에러 상세 미노출.
7. **fingerprint**: production×dev-ref, development×prod-ref 조합 throw(유닛 테스트) + 로컬 스택 URL(127.0.0.1) 통과 — 기존 E2E 그린 유지.
8. **DEV 배지**: Preview·dev 브랜치·로컬 표시 / Production 미표시 / E2E·axe 게이트 그린(non-interactive).
9. **백업**: `SUPABASE_PROD_DB_URL` rename + 구 시크릿 삭제 + workflow_dispatch 그린 + **아티팩트 로컬 restore 1회**(일회용 Postgres에 복원 → 주요 테이블 존재 + row count sanity — ADR-075 게이트 2 생존 검증 겸함).
10. **ADR-075 게이트 생존**: dev-wipe.sql 부재 유지(→ wrapper 대체 확인) / `sb_*` 키 체계 양쪽 확인.
11. **secret residue**: grep 대상 — `sb_secret_`/`service_role`/prod DB URL/legacy JWT. 확인 — 로컬 3파일 dev only / `.claude/settings.local.json` 정리 / git tracked 파일에 시크릿 0 / `/tmp` dump·셸 env 잔존 0. (PROD_REF 자체는 공개 식별자 — 가드 상수로 존재 허용, 시크릿과 혼동 금지)
12. **문서 sweep**: 레포 전체 `dev=prod`/`ADR-075` grep → 살아있는 문서만 갱신(과거 스펙 불변) / `.env.example` 2곳 갱신 / `docs/ADR.md`에 ADR-106~109 + 체인 주석 반영 확인.

---

## 15. 문서 갱신 / 마무리

- 루트 `CLAUDE.md` "현재 단계" + `docs/STATUS.md` 갱신 (환경 표기: isakok-prod / isakok-dev 통일).
- **`docs/ADR.md`**: ADR-106~109 추가 + 체인 주석(§13). DECISIONS.md에는 중복 기록하지 않음(기획 스냅샷 — ADR 정본 아님).
- 구현 완료 후 `/handoff` + `14-env-separation-verify.md` 작성(§14 골격 기준).
- **14단계 브리핑 문서는 본 스펙에 흡수 완료 → 삭제.**
