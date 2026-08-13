# 14단계: Supabase dev/prod 환경 분리 — 검증 리포트

> 검증일: 2026-08-13 · 브랜치 `feat/env-separation`(main 대비 26파일) · 구현 세션과 분리된 verify 세션에서 실행
> 기준: `docs/specs/14-env-separation.md` §14 Verify 골격 12항목
> 표기: `[x]` 이번 세션 재실측/코드 검증 통과 · `[△]` 구현 세션 실측 기록(STATUS.md) 근거 — 코드로 재실측 불가 · `[ ]` 미충족(사유 병기)

## 완료 확인 기준 결과 (§14 골격 12항목)

- [△] **1. 채널 페어링 실측** — EAS preview APK 실기기: 온보딩→대시보드 + Google 로그인 ✅(세션 브릿지 `setSession()`→`getUser()` 완결, STATUS 기록). 로컬 웹(.env=dev) 스모크 ✅. EAS production/Vercel Production은 무변경이라 기존 그린 유지. 웹 번들 ref 검증(isakok-dev=dev ref만/isakok=prod ref만) 기록 있음.
- [△] **2. prod 접촉 allowlist 준수** — 기록상 충족: 시크릿 선설정 → `functions:deploy:prod`(함수만, 가드 경유) → 마이그레이션 히스토리 불변. READ는 `ai_guide_cache` dump 1회뿐(아래 "캐시 시딩 오판→정정" 참조). 단 ADR.md에 no-op 오서술 잔존 → 🔴 수정 필요(아래).
- [x] **3. 가드 동작** — 이번 세션 재실측: `functions:deploy:prod` 인자 없음 거부 / ref 불일치 거부 / `db:push:prod` ref 불일치 거부 / 알 수 없는 명령 거부 — 4건 전부 exit 1. 긍정 케이스(dev push/deploy·prod deploy)와 `db:reset:dev` 거부는 구현 세션 실측 기록. `deploy:dev` prod link 중단은 코드 검증(`assertLinkedDev`, linked ref 판독 실패 시에도 거부 = fail-closed) + 현재 linked=dev 확인.
- [△] **4. CORS 매트릭스** — 구현 세션 실측: dev 6-origin 허용 + 시크릿 unset 시 fail-closed(실측 후 복구) / prod는 isakok.vercel.app만 204, localhost·LAN·isakok-dev·무작위 403. 이번 세션 코드 재검증 [x]: `cors.ts` 미설정→빈 목록, `ENVIRONMENT === 'development'` 정확 일치 시에만 localhost 합집합(오타·미설정 전부 닫힘), `Vary: Origin` 전 응답 부착, 호출부 4곳 DENY 선차단(security-auditor 교차 확인).
- [x] **5. dev 구축 parity** — 마이그레이션 28개(로컬 카운트 재실측) / 함수 9개 디렉토리(재실측) / seed 46건 [△ 기록] / **dev 대상 RLS 스모크 18/18 [△ 기록]** — 스펙 표기 "16/16"은 작성 시점 수치, 13단계 테스트 증가분으로 상회 충족 / `ai_guide_cache` row count prod==dev + generating_at 전부 NULL [△ 기록].
- [△] **6. 외부 연동 기대 상태** — Google 로그인 실기기 완주 ✅ / Apple·Kakao dev 시크릿 미존재 + 통제된 실패 + 응답에 내부정보 미노출(`API_FAIL`/`NOT_FOUND`만) ✅ (기록). **단, `linkIdentity` 승격·사진 게이트·계정 삭제의 dev 완주는 실측 기록에 명시 없음 → 미검증 잔여로 명기** (Google 로그인 성공이 승격 경로를 일부 커버하나 개별 확인 아님).
- [x] **7. fingerprint** — 유닛 테스트 6/6 이번 세션 재실측 그린: production×prod 통과 / development×dev 통과 / production×dev-ref throw / development×prod-ref throw / 로컬 스택(127.0.0.1) 제외 / URL 누락 제외. `main.tsx` 렌더 전 + Sentry init 이후 호출(throw 수집 가능). E2E 그린은 CI 게이트에서 확인(로컬 미실행).
- [△] **8. DEV 배지** — 로컬 표시 실측 + 스크린샷(`stage14-dev-badge-dashboard.png`) 확보. Production 미표시는 코드 보장(`isProduction()` → null). **Preview·dev 브랜치 표시는 머지 후 `main:dev` 재발행 시 확인**(dev 웹이 아직 main 스냅샷 서빙 — 알려진 문제). `aria-hidden` + `pointer-events-none`으로 E2E·axe 영향 0(web-a11y 교차 확인).
- [ ] **9. 백업** — `SUPABASE_PROD_DB_URL` 시크릿 생성 + 워크플로 참조 전환 + 헤더 각인까지 완료 [x]. **구 시크릿 삭제 / workflow_dispatch 1회 / 아티팩트 restore 테스트는 미실시** — `workflow_dispatch`는 default branch 필수 제약으로 머지 후 잔여 ①②로 이연(사유 있는 이연, main 워크플로가 구 이름 참조 중이라 즉시 삭제 시 nightly 백업 파손).
- [x] **10. ADR-075 게이트 생존** — dev-wipe.sql 부재 유지(파일·참조 0, 재실측) + `db:reset:dev` wrapper 대체 확인. legacy JWT 비활성 양쪽(dev·prod) [△ 기록], `sb_*` 키 체계 양쪽 유지.
- [x] **11. secret residue** — tracked 파일 `sb_secret_` 실값·legacy JWT(`eyJ…`)·prod DB URL 전부 0건(이번 세션 git grep 재실측 + security-auditor 교차). 로컬 3파일(.env.local·apps/web/.env.local·apps/mobile/.env) 전부 dev ref만(재실측). `.claude/settings.local.json` 인라인 키 잔재 0 — 단 prod ref 항목 2줄(nslookup 허용 목록 :141-142) 잔존 🟡(공개 식별자라 무해, §5-3 대비 정리 권장). `/tmp` dump·셸 env 잔존 0은 구현 세션 확인 기록 [△]. 루트 `.env.local`의 `SB_MGMT_TOKEN`은 계획된 잔여 ④(머지 후 제거).
- [x] **12. 문서 sweep** — 살아있는 문서의 `dev=prod` 언급은 전부 "종료/당시" 역사적 문맥만(재실측: CLAUDE.md·README·e2e-testing.md). `.env.example` 2곳 갱신 ✅. `docs/ADR.md` ADR-106~109 + 체인 주석 4곳(068:465·069:471·075:515·099:744) ✅. ci.yml/rls-ci.yml은 주석만 변경(코드 무변경) 재실측 ✅. **단 ADR-069 체인 주석과 ADR-107 본문에 "no-op" 오서술 잔존** → 🔴(아래 Codex/spec-reviewer 섹션).

### 캐시 시딩 오판→정정 기록 (보존 — 회귀 방지)

- **문제**: 최초 anon REST 카운트로 "prod 캐시 0건 → 시딩 no-op" 판단. `ai_guide_cache`는 10-2부터 service-role 전용이라 **RLS 차단을 빈 테이블로 오독**한 것 (RLS smoke `data.length===0` 교훈의 일반화 — STATUS 실패한 접근에 등재됨).
- **수정**: Management API query(서비스 레벨)로 재측정 → prod 완성 5건 확인 → 정식 시딩 수행, 키셋 일치 + `generating_at` 전부 NULL 검증 완료. **잔여였던 ADR 오서술도 정정 완료 ✅**: `docs/ADR.md` ADR-069 체인 주석·ADR-107 본문의 "0건이라 no-op 성립"을 "오판(RLS 차단 오독) → 서비스 레벨 재측정 5건 → 정식 시딩" 서사로 교체(문제·수정 양쪽 보존).

## 빌드·린트·테스트 (이번 세션 재실측)

- `pnpm lint` ✅ / `pnpm typecheck` ✅ / `pnpm test` ✅ (shared 38 + web 41 = 79개, envFingerprint 6 포함) / `pnpm build` ✅

## 누락 (스펙에 있는데 구현 안 됨)

- §14-9 백업 workflow_dispatch + restore 테스트 — **사유 있는 이연** (default branch 제약, 머지 후 잔여 ②)
- 구 GitHub 시크릿 `SUPABASE_DB_URL` 삭제 — **사유 있는 이연** (main 워크플로가 구 이름 참조 중, 머지 후 잔여 ①)
- §14-6 중 `linkIdentity` 승격·사진 게이트·계정 삭제 dev 개별 완주 — 실측 기록 없음(미검증 잔여)
- §5 코드 변경 항목 자체의 누락: **없음**
- ⚠️ **스펙 자체 결함** (구현 누락과 구분): §2-3 배포 주의 목록이 `cleanup`만 `--no-verify-jwt` 대상으로 명시하고 **`kakao-unlink-webhook`(verify_jwt 꺼짐 필수, ADR-078)을 누락** → 배포 스크립트에 그대로 전파됨 (Codex P1)

## 스코프 크립 (구현했는데 스펙에 없음)

- `scripts/sbapi.mjs` (신규 46줄) — Management API 범용 헬퍼. STATUS에 기록은 있으나 스펙 §5 목록 밖. 🟡 `supabase-cmd.mjs` 가드 철학과 달리 임의 METHOD/PATH를 무가드 통과(PROD_REF 경로 포함 가능) — 가드 1줄 또는 "가드 계층 밖" 헤더 경고 권장. `SB_MGMT_TOKEN` 제거(잔여 ④) 후엔 자연 무력화.
- 주석 sweep 파일들(send-notifications·env.ts·webVitals.ts·README·e2e-testing.md) — §7 처분표 범위 내, 크립 아님 🟢
- Vercel Authentication 해제·EAS `GOOGLE_SERVICES_JSON` 파일 시크릿 — 스펙 외 콘솔 결정이나 ADR-108·STATUS에 근거 기록 완료 🟢

## 컨벤션 위반

- 🟡 `apps/web/src/lib/envFingerprint.ts` 배치 — apps/web/CLAUDE.md의 lib/ 규칙("supabase 클라이언트 + cn 유틸, 그 외 로직 금지") 자구 위반. env 배선 검증이라 lib/supabase.ts 인접 논리는 있음 — CLAUDE.md lib/ 항목에 예외 명시 또는 `observability/` 이동 검토.
- 🟡 `.claude/settings.local.json:141-142` prod ref 항목 2줄 잔존 (§5-3 "기존 ref 제거" 대비 — 공개 식별자라 보안 무해, 정리 권장)
- 그 외(named export·JSDoc·import 순서·커밋 단위 1~3파일 16커밋) 준수 🟢

## Codex 코드리뷰 결과

`/codex:review` 브랜치 리뷰(main 대비, 2026-08-13) — P1 1건 / P2 2건. verify 세션은 리뷰 전용이라 수정 미반영(⏳)이었고, **구현 세션 후속에서 전부 반영·재검증 완료(아래 각 항목 "수정" 갱신 + 종합 판정 참조)**.

- **[P1] scripts/supabase-cmd.mjs:50-52** — kakao-unlink-webhook의 JWT-off 배포 보존 누락
  - 문제: 배포 래퍼의 전체 함수 deploy가 `kakao-unlink-webhook`을 기본값(JWT 검증 ON)으로 재배포하고 `cleanup`만 `--no-verify-jwt`로 보정. 카카오는 Supabase JWT가 아닌 `KakaoAK` 헤더를 보내므로 게이트웨이가 unlink 콜백을 핸들러 도달 전에 거부 — supabase/CLAUDE.md(ADR-078)의 "verify_jwt 꺼짐" 계약 위반. **verify 세션 사실 확인: config.toml에 `verify_jwt=false` 선언은 health·send-notifications뿐, kakao-unlink-webhook은 config.toml에도 스크립트에도 없음.** 파급: Phase D에서 이 래퍼로 prod 함수를 재배포했으므로 **prod의 kakao-unlink-webhook이 현재 JWT 검증 ON 상태일 가능성 높음(라이브 회귀 의심)** — dev도 동일.
  - 수정: ✅ 반영 — ① **config.toml `[functions.kakao-unlink-webhook] verify_jwt = false` 선언 방식** 채택(스크립트 특례가 아니라 모든 배포 경로에 적용 — health·send-notifications가 이 방식으로 벌크 배포에서 생존함이 prod 실측으로 증명된 메커니즘) ② 상태 점검 실측: **prod·dev 모두 `verify_jwt=true`로 깨져 있음 확인**(Management API) → 플래그 없이 재배포해 선언 적용을 검증 → **양쪽 `verify_jwt=false` 복구 실측** ③ 스펙 §2-3에 정정 주석 추가. 완화 요인: Kakao 콘솔 웹훅 등록이 10-4 잔여로 미완이라 실트래픽 영향은 없었을 가능성 높음.
- **[P2] apps/web/src/lib/envFingerprint.ts:7** — hosted URL 정규화 부재
  - 문제: 정규식이 trailing slash·공백·대문자 스킴을 불허해 그런 변형 URL(supabase-js는 정상 수용)이면 ref 검사를 조용히 스킵 — "비production×prod-ref 최악 조합"이 슬래시 하나로 우회 가능. security-auditor·spec-reviewer 교차 확인(다층 방어의 한 겹이라 심각도는 낮음).
  - 수정: ✅ 반영 — 매치 전 `trim().toLowerCase().replace(/\/+$/,'')` 정규화 + 우회 케이스 테스트 1건(변형 4종: trailing slash·공백·대문자·dev URL slash) 추가 → 유닛 7/7 그린.
- **[P2] scripts/sbapi.mjs:45-46** — Management API 실패 시 exit 0
  - 문제: HTTP 4xx/5xx에도 응답만 출력하고 종료 코드 0 — `&&` 체인·`set -e` 스크립트가 거부된 PATCH/POST를 성공으로 오인해 반쯤 설정된 환경으로 진행. ux-state-reviewer도 🔴로 동일 지적.
  - 수정: ✅ 반영 — `if (!res.ok) process.exitCode = 1`(404 실측 exit=1) + security 🟡①과 묶어 헤더에 시크릿 반환 엔드포인트 취급 경고·"ref 가드 없음" 명시 주석 추가.

## spec-reviewer 결과

복잡 단계(Edge Function+클라이언트+인프라 동시 변경) 해당 — 심층 비교 수행.

- **일치 🟢**: §5-1 cors(의사코드와 의미론 완전 일치, `!== 'production'`→`=== 'development'` 강화는 fail-closed 방향) / §5-2 가드 6명령+원칙 3줄+`--` 필터+prod ref 에러 메시지 비노출(스펙 초과 방어) / §5-3 .env.example 2곳+실값 3파일 dev·심링크 해체 / §5-4 rename+헤더 각인 / §5-5 주석 2곳 / §5-6 fingerprint 6케이스 / §4-3 eas.json 두 줄만 / §4-4 배지 / §8 CI 주석만 / §15 문서(ADR-106~109+체인 4곳, 브리핑 문서 부재=삭제 충족) / §7 dev-wipe 부재·시크릿 잔존 0
- **차이 🔴 1건**: `docs/ADR.md:471`·`:807` 캐시 시딩 "no-op" 오서술 잔존 — STATUS:16 정정 기록과 정면 모순, ADR은 정본 로그라 감사 추적 왜곡. "최초 anon 카운트 오판(0건) → 서비스 레벨 재측정 5건 → 정식 시딩"으로 정정 필요.
- **차이 🟡 2건**: settings.local.json ref 잔존 / fingerprint URL 정규화 부재(Codex P2와 동일)
- **누락**: 전부 사유 있는 이연(백업 dispatch/restore, 구 시크릿 삭제) — §5 코드 누락 0
- **스코프 크립 🟡 1건**: sbapi.mjs 무가드(위 섹션)
- **컴포넌트 설계**: DevBadge·assertEnvRefPairing 컨벤션 준수 🟢 / envFingerprint lib/ 배치 🟡

## 서브에이전트 리뷰 결과

- **security-auditor**: 🔴 0 / 🟡 4 / 🟢 다수 — ① sbapi.mjs 응답 무필터 출력이 시크릿 반환 엔드포인트(`/api-keys`·`/secrets`) 경유 유출 채널(redact 또는 경로 거부 권장) ② `PROD_DB_URL` substring 대조 약함(`new URL` hostname 정확 대조 권장, dry-run+yes가 2차 방어라 잔여 위험 낮음) ③ fingerprint trailing-slash 우회(Codex P2 동일) ④ db-backup 아티팩트 90일 보존 — 레포 public 전환 시 암호화/외부 이전 재검토 트리거 등록. 통과: cors fail-closed 의미론(호출부 4곳 DENY 선차단, ENVIRONMENT 오설정 시 개방 상한=localhost 1개), 가드 fail-closed(판독 실패→거부, ref 명시 고정), 토큰 유입 경로(히스토리·argv 미노출), secret residue 0, 워크플로 3종.
- **web-a11y-reviewer**: 🔴 0 / 🟡 2(선택) / 🟢 다수 — 배지의 접근성 트리·포커스·히트테스트 3경로 배제 완전(스펙 "영향 0" 충족), WCAG 2.5.8/2.4.11/4.1.2 통과, 모달 스태킹 무해. 선택 개선: ① 브라우저(safe-area 0)에서 헤더 우상단 버튼 부분 가림 — `top-[calc(env(safe-area-inset-top)+8px)]` ② fingerprint throw 시 빈 화면 — 순수 DOM 폴백 문구 1줄(개발자 전용 실패라 수용 가능이 결론).
- **ux-state-reviewer**: UI 4상태 검사 대상 0(이번 단계 UI 변경은 전부 동기 코드) — CLI 스크립트 실패 상태로 한정 검사. 완전 2(supabase-cmd·rls-smoke) / 불완전 1(sbapi.mjs) — 🔴 sbapi exit 0(Codex P2 동일) / 🟡 rls-smoke 시드 upsert 에러 미확인(false-pass 가능:118·165) / 🟡 rls-smoke move 생성 실패 시 조기 중단 없음(:65) / 🟡 supabase-cmd spawn 자체 실패 시 원인 메시지 미출력(:36).
- **native-a11y-reviewer / perf-budget-reviewer**: 해당 없음 (트리거 조건 미충족 — apps/mobile/src 변경 없음, 신규 의존성 없음·스크립트만 추가)

## 종합 판정

**최초 판정 ❌ 수정 필요** (2026-08-13 verify 세션) — 코드로 검증 가능한 §5 전 항목이 스펙과 일치하고 빌드·린트·테스트(79개) 그린이나, 머지 전 수정이 필요한 발견 4건(P1 1·🔴 1·P2 2) + 선택 🟡 6건.

**최종 판정 ✅ 통과** (2026-08-13 수정 반영 후 재검증) — 필수 4건 + 선택 6건 전부 반영·실측:

1. **[P1] kakao-unlink-webhook** ✅ — config.toml 선언 + 양쪽 재배포, **dev·prod `verify_jwt=false` 복구 실측**(Management API) + 스펙 §2-3 정정 주석
2. **[🔴] ADR 오서술** ✅ — ADR-069 체인·ADR-107 본문을 오판→정정 서사로 교체
3. **[P2] fingerprint 정규화** ✅ — 유닛 7/7 그린(우회 변형 4종 케이스 추가)
4. **[P2] sbapi exit code** ✅ — 404 실측 exit=1 + 시크릿 엔드포인트 경고 주석
5. **[🟡 선택 6건 전부]** ✅ — settings.local.json prod ref 2줄 제거 · rls-smoke 시드 upsert assert 2건+move 실패 조기 중단+**시드 잔존 Cleanup 추가**(dev 재실행 **20/20** + `__rls_smoke_test__` 잔존 0 실측) · supabase-cmd spawn 실패 원인 메시지 · `PROD_DB_URL` `new URL` 파싱 대조(직결 hostname·pooler username 두 형태, 오형식 거부 2케이스 실측) · DevBadge `top-[calc(env(safe-area-inset-top)+0.5rem)]` · fingerprint lib/ 배치는 apps/web/CLAUDE.md lib/ 규칙에 예외 명시

- 재검증: `pnpm lint`/`typecheck`/`build` ✅ · 테스트 **80개**(web 42 + shared 38) ✅

머지 후 잔여(계획대로, 이 판정과 별개): 구 시크릿 삭제 ① · 백업 dispatch+restore ② · `main:dev` 재발행 ③ · `SB_MGMT_TOKEN` 제거 ④ · (선택) 세션 노출 키 rotate ⑤ + §14-6 회원 전용 영역(linkIdentity 승격·사진 게이트·계정 삭제) dev 완주 실측.
