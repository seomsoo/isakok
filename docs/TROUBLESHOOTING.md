# 트러블슈팅 노트

> 이 프로젝트는 AI 보조로 개발하고, 구현과 **다른 모델(Codex)로 교차 리뷰**를 걸어 검증. 아래는 그 과정에서 드러난 기술 이슈를 **원인·해결 중심으로 정리한 기록**

대부분 Codex 교차 리뷰나 검증 단계에서 발견(출처에 `verify`/`STATUS` 표시). 발견 경로보다 **원인 분석과 해결**에 초점. 운영 장애 대비(봇 무한 생성·비용 폭주 등)는 별도 운영 매뉴얼([harness-ops.md](harness-ops.md)).

각 항목: **증상 → 원인 → 해결 → 출처**.

---

## 동시성 · 경합

### 1. 디바운스 자동저장이 옛 값으로 최신을 덮어씀

- **증상**: 메모를 빠르게 편집하면 가끔 이전 입력이 최신 입력을 덮어씀
- **원인**: 디바운스 저장이 `mutate`를 즉시 호출 → 병렬 요청에서 늦게 도착한 옛 응답이 최신을 덮어씀. 변경 판별을 서버 prop(비동기 fetch 전 stale 스냅샷)으로 해서 빠른 편집 시 순서 역전
- **해결**: `inFlightRef`(진행 중) + `pendingRef`(대기 중 최신값)로 직렬화 — 진행 중이면 최신값만 pending에 덮어쓰고 네트워크 호출은 스킵, `onSuccess`에서 pending 있으면 그 값으로 재호출. 변경 판별은 서버 prop 대신 `lastSavedRef`(마지막 전송값)로
- **출처**: [04-detail-verify](specs/04-detail-verify.md) P1, [06-property-photo-verify](specs/06-property-photo-verify.md) P1

### 2. in-flight 락(30초)이 LLM 타임아웃(120초)보다 짧아 중복 호출

- **증상**: AI 가이드가 같은 조건 조합으로 Claude를 중복 호출 (비용 낭비 + 캐시 경합)
- **원인**: 중복 생성을 막는 in-flight 락의 만료를 30초로 뒀는데 Anthropic 응답이 120초까지 걸림 → 30초 지나면 다른 요청이 락을 재획득해 두 번째 호출 발생
- **해결**: stale 락 판정 간격을 150초(LLM 120초 + 버퍼 30초)로 확장 (`00012` 마이그레이션)
- **출처**: [07-ai-guide-verify](specs/07-ai-guide-verify.md) P2

### 3. 동시 업로드로 방별 사진 장수 제한 우회

- **증상**: 방별 `maxCount`를 동시 업로드로 초과
- **원인**: 잔여 슬롯(`remaining`)을 현재 `photos.length`만으로 계산 → 진행 중인 업로드가 있으면 두 번째 배치가 같은 `remaining`을 보고 통과
- **해결**: 업로드 진입 시 `uploadingCount > 0`이면 조기 리턴해 동시 업로드 차단
- **출처**: [06-property-photo-verify](specs/06-property-photo-verify.md) P2

---

## 비동기 상태 · 데이터 정합

### 4. 캐시 버전 조기 bump로 실패 시 stale 가이드 영구 제공

- **증상**: AI 호출이 실패하면 옛 가이드가 계속 제공됨
- **원인**: 캐시 row의 `master_version`을 새 버전으로 먼저 올리면서 `guides`는 옛 값 유지 → 호출 실패 시 `generating_at`만 비워서, 다음 요청이 버전 일치로 캐시 히트 판정 → stale guides 영구 제공
- **해결**: 실패 catch에서 `master_version`을 0으로 리셋(실제 버전 1+과 불일치) → 다음 요청이 재생성 분기로 진입
- **출처**: [07-ai-guide-verify](specs/07-ai-guide-verify.md) P1

### 5. 비동기 쿼리 완료 전에 "비었음"으로 판정해 리다이렉트

- **증상**: 사진·밀린 항목이 있는데도 콜드 로드 시 다른 화면으로 튕김 (캐시 warm 상태에서만 정상)
- **원인**: 비동기 쿼리의 기본값(`[]` / `undefined`)으로 즉시 `length === 0` 판정. `isLoading`·`isError` 미체크 → 쿼리 에러와 "빈 데이터"를 구분 못 함
- **해결**: `isLoading` 동안 Skeleton, 완료 후에만 리다이렉트 판정 + `isError` 분기로 에러 UI 노출
- **출처**: [03-verify](specs/03-verify.md) P2 (PreCheckPage), [06-property-photo-verify](specs/06-property-photo-verify.md) P1 (PhotoReportPage)

---

## 보안

### 6. SECURITY DEFINER 함수 overload로 RLS 우회 가능

- **증상**: 권한 검사 함수의 시그니처를 바꿨는데 옛 버전이 남아 RLS를 우회할 수 있는 상태
- **원인**: PostgreSQL `CREATE OR REPLACE FUNCTION`은 **동일 시그니처만** 대체 — 파라미터 수가 다르면 별개 overload로 생성되어 옛 SECURITY DEFINER 함수가 잔존
- **해결**: SECURITY DEFINER 함수 시그니처 변경 시 `DROP FUNCTION IF EXISTS`로 옛 버전을 먼저 제거
- **출처**: [STATUS](STATUS.md) "실패한 접근"

### 7. Sentry로 에러 메시지 속 개인정보 누수

- **증상**: 에러 메시지·스택에 박힌 주소·이메일이 Sentry로 샐 수 있음
- **원인**: user·request·breadcrumb 같은 구조화 필드만 스크럽하면 부족 — 실제 최대 누수 경로는 `exception.value`, `event.message`, stack frame `filename` 쿼리의 자유 텍스트
- **해결**: `beforeSend`에서 자유 텍스트까지 redact(URL query strip + 이메일 마스킹) + 1-depth → 재귀 스크럽. 한글 주소는 패턴화 불가라 "에러 메시지에 PII 미보간" 호출부 규율이 1차 방어, 스크럽이 마지막 그물
- **출처**: [STATUS](STATUS.md) "실패한 접근", ADR-089

---

## 빌드 · 배포

### 8. RN 버전 드리프트 — dev는 통과, EAS 번들만 코드젠 실패

- **증상**: 로컬 dev(Metro)는 멀쩡한데 EAS production 번들(`expo export`)에서만 코드젠 실패
- **원인**: `react-native`를 Expo SDK가 고정한 버전(0.83.6)보다 올림. `babel-preset-expo`가 RN babel preset을 정확히 고정 의존이라, RN만 앞서면 production 번들 코드젠이 새 네이티브 컴포넌트 파싱 실패. dev Metro는 지연 변환이라 우회돼 안 보이고 번들 단계에서만 터짐
- **해결**: `react-native` 등 RN 생태계(`react`·`react-native-*`)는 `expo install`로만 갱신 + Dependabot ignore
- **출처**: [STATUS](STATUS.md) "실패한 접근", ADR-097

---

## 하이브리드 (WebView)

### 9. 탭 첫 진입 시 뜨는 네이티브 에러 화면 ("웹뷰 티")

- **증상**: 대시보드에서 다른 탭을 처음 누르면 가끔 네이티브 "다시 시도" 화면이 뜸
- **원인**: 탭마다 독립 WebView가 원격 URL을 콜드 로드하는데, 자동 재시도가 없고 타임아웃이 빡빡(15초)해 잠깐의 네트워크 끊김도 곧장 에러 화면
- **해결**: 무음 자동 재시도 2회(800ms backoff) + 스톨 기반 타임아웃(30초, 진행마다 재무장) + RNW 기본 에러 페이지 `preventDefault`. (Codex P1 — `onLoadEnd`가 재시도 상태를 덮어쓰던 버그도 함께 수정)
- **출처**: [UI-POLISH §12](UI-POLISH.md), ADR-084

### 10. 익명 → 소셜 전환 시 placeholder 이메일 중복(409)

- **증상**: 익명 계정을 카카오로 전환할 때 가끔 email duplicate(409)로 실패
- **원인**: placeholder 이메일을 `kakao_${kakaoId}@isakok.invalid` 고정값으로 생성 → 옛 테스트 잔재 orphan user가 같은 placeholder를 점유하면 충돌
- **해결**: `kakao_${kakaoId}_${anonymousUserId}@isakok.invalid`처럼 익명 UID를 섞은 고유값으로 생성
- **출처**: [STATUS](STATUS.md) "실패한 접근"
