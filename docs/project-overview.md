# 이사일정관리 웹앱 — 기획 정리

## 프로젝트 한 줄 정의

이사일을 입력하면 할 일이 자동으로 일정에 배치되고, 집 상태를 사진으로 기록해 보관할 수 있는 앱

---

## 1. 타겟 & 문제 정의

### 메인 타겟

직장인 잦은 이사러 (28세 전후, 1-2년마다 계약 만료로 이사, 원룸/오피스텔/빌라)

- 이사 빈도 높아서 반복 사용 가능성 큼 (리텐션 핵심)
- 매번 퇴실하니까 보증금 분쟁 위험 누적

### 서브 타겟

사회초년생 첫 직장 이사 (지방→서울, 급하게 방 구해서 들어가야 하는 상황)

- 가이드 절실 + 급함 조합 → 유입(acquisition) 채널
- 시간이 지나면 메인 타겟으로 전환됨

### 핵심 문제 A: 체계 없는 이사 관리

- 할 일은 아는데 체계가 없어서 매번 빠뜨림
- 정보가 블로그, 카톡, 메모앱에 흩어져 있음
- 이사할 때마다 처음부터 다시 조립
- 관련 페인포인트: P1, P2, P4, P5, P7

### 핵심 문제 B: 증거 없는 보증금 분쟁

- 입주/퇴실 시 집 상태를 기록해야 하는 건 아는데 수단이 없음
- 사진이 갤러리에 묻히거나 아예 안 찍어서 금전 피해 반복
- 관련 페인포인트: P3, P6, P8

### 두 문제의 연결 구조

A 해결(타임라인 → "입주 사진 찍기" 알림) → B도 자연스럽게 해결

---

## 2. MVP 기능 (v1.0)

### F1. 스마트 타임라인

- 이사일 입력 → D-30~D+7 기준으로 할 일이 실제 날짜에 자동 배치
- 블로그 체크리스트와 차별점: "내 이사일 기준 구체적 날짜"

### F2. 맞춤 체크리스트

- 마스터 체크리스트(40-50개)에서 조건 태그 기반 필터링
- 온보딩 입력: ① 이사 예정일 ② 주거 유형(원룸/오피스텔/빌라/투룸+) ③ 계약 유형(월세/전세)
- 유저에게 보이는 항목: 15-25개

### F4. 집 상태 기록

- 방별 촬영 가이드(현관→거실/방→화장실→주방→베란다)
- 사진 + 메모 저장 → 날짜 기반 "입주 상태 리포트"

### 향후 버전

- v1.1: F3 리마인더 알림, F5 입주/퇴실 비교 뷰어
- v2.0: F6 이사 히스토리

---

## 3. 유저 플로우 (9 Steps)

1. 랜딩 → 이사 시작하기 (가입 없이 바로 시작)
2. 이사 정보 입력 (3단계 폼) → 맞춤 타임라인 즉시 생성
3. 대시보드 — 오늘의 할 일 확인 (핵심 루프)
4. 타임라인 전체 보기
5. 체크리스트 항목 상세 (가이드 + 관련 링크)
6. 타임라인에서 "집 상태 기록" 유도 (F1→F4 자연스러운 연결)
7. 촬영 가이드 → 방별 사진 기록
8. 기록 완료 → 요약 리포트
9. 이사 완료 + 회원가입 유도 (데이터 쌓인 시점에 가입 동기)

### 설계 포인트

- 가입 벽을 뒤로 미룸 (Step 1→9)
- F1(타임라인) 안에 F4(상태 기록)가 할 일로 녹아들어감
- 핵심 루프는 대시보드 (Step 3)

### 필요 화면: 7개

랜딩, 온보딩 폼, 대시보드(메인), 타임라인 뷰, 항목 상세, 집 상태 기록, 상태 리포트, 가입/로그인

---

## 4. 오프라인 전략 — "오프라인 세이프"

| 기능                 | 오프라인                   | 방식                   |
| -------------------- | -------------------------- | ---------------------- |
| 체크리스트 보기/체크 | OK                         | 로컬 캐싱 + 동기화     |
| 사진 촬영 + 메모     | OK                         | IndexedDB에 Blob 저장  |
| 타임라인 조회        | OK                         | 로컬 캐싱              |
| 사진 서버 업로드     | 온라인 복귀 시 자동 동기화 | 큐에 쌓아두기          |
| 온보딩 (첫 설정)     | 온라인 필요                | 마스터 체크리스트 로드 |
| 회원가입/로그인      | 온라인 필요                | 인증                   |

핵심: 이사 당일 새 집에 인터넷 없어도 사진 촬영/체크리스트 확인 가능

---

## 5. 기술 스택

### 프론트엔드 (앱 셸)

- **Expo (React Native)** — 앱 스토어/플레이 스토어 배포, EAS Build로 클라우드 빌드

### 프론트엔드 (WebView 웹앱)

- **React (Vite)** + TypeScript + Tailwind CSS
- 선택 근거: WebView SPA에 SSR 불필요, Next.js는 오버스펙. Vite가 가볍고 빠르며 WebView 호환성 좋음
- **TanStack Query** — 서버 상태 관리 (캐싱, 낙관적 업데이트, 백그라운드 리페칭)
- **Zustand** — 클라이언트 상태 관리 (UI 상태: 현재 이사 ID, 모달 상태 등)
- 상태관리 분리 근거: 서버 상태(체크리스트, 사진)와 클라이언트 상태(UI)를 명확히 분리. 서버 데이터는 캐싱/동기화가 필요하고 UI 상태는 불필요

### 코드 아키텍처 — 서비스 레이어 패턴

```
src/
├── services/       ← Supabase 호출 (순수 함수, React 의존 없음)
│   ├── auth.ts
│   ├── moves.ts
│   ├── checklist.ts
│   └── photos.ts
├── hooks/          ← TanStack Query + 서비스 조합 (상태 관리)
│   ├── useChecklist.ts
│   ├── usePhotos.ts
│   └── useMove.ts
└── components/     ← UI만 담당
```

- 서비스 레이어: 데이터를 "어떻게 가져오는지" 담당 (테스트 가능, 재사용)
- 훅 레이어: 가져온 데이터를 "어떻게 상태로 관리하는지" 담당
- 컴포넌트: 순수 UI만 담당 (데이터 소스를 모름)
- Interface/Repository 패턴은 사용하지 않음 (구현체가 Supabase 하나뿐이라 불필요한 추상화)

### 백엔드 / DB / 인증 / 스토리지

- **Supabase** — PostgreSQL + Auth(카카오/구글 소셜 로그인) + Storage(이미지) + RLS(보안)
- 선택 근거: 관계형 데이터(유저↔이사↔체크리스트)에 적합, 1인 개발 BaaS

### 배포

- **Vercel** — 웹앱 호스팅 (정적 파일 배포), 무료 티어
- **EAS Build** — Expo 앱 빌드, iOS/Android

### 개발 도구

- TypeScript, ESLint + Prettier, Vitest

### 향후 확장 시 (랜딩 페이지)

- Turborepo 모노레포로 전환
- apps/web (React Vite) + apps/landing (Next.js) + apps/mobile (Expo)
- packages/shared (API 로직, 타입, 상수 공유)

### 비용

| 항목            | 비용                             |
| --------------- | -------------------------------- |
| 월 운영 (MVP)   | $0 (Vercel Free + Supabase Free) |
| Play Store 등록 | $25 (1회)                        |
| App Store 등록  | $99/년 (유저 확보 후)            |
| 도메인          | ~$12/년                          |

---

## 6. 경쟁 서비스 분석 요약

### 한국 시장

- 짐싸, 짐카, 이사모아: 견적 비교/업체 연결에 집중. 이사 과정 관리 없음
- 다방, 오늘의집: 정적 체크리스트 블로그 콘텐츠만 제공
- 아파트너: 하자 접수 기능 있지만 신축 아파트 전용

### 해외

- MoveAdvisor: 가장 가까운 경쟁자 (타임라인+체크리스트+인벤토리), 영어 전용/미국 최적화
- Sortly: 짐 인벤토리 특화
- Pro Moving Planner: 가구 배치/예산 추적

### 빈 포지션

"이사 과정 전체 일정 관리 + 집 상태 사진 기록 + 한국 청년 세입자 최적화" 조합은 국내외 없음

---

## 7. DB 스키마 (Supabase / PostgreSQL)

### 테이블 구조 (5개)

**users** — 유저 프로필 (Supabase Auth 확장)

- id, email, nickname, provider, created_at, updated_at

**moves** — 이사 건별 정보

- id, user_id(FK, indexed), moving_date, housing_type(CHECK), contract_type(CHECK), move_type(CHECK), status(CHECK), from_address, to_address, created_at, updated_at, deleted_at(soft delete)

**master_checklist_items** — 마스터 체크리스트 (조건 태그 기반 필터링)

- id, title, description, guide_content, guide_url, d_day_offset, housing_types(text[]), contract_types(text[]), move_types(text[]), category, sort_order, is_skippable(boolean, false=필수/true=선택), guide_type(CHECK: 'tip'|'warning'|'critical'), created_at, updated_at

**user_checklist_items** — 유저별 체크리스트 상태

- id, move_id(FK, indexed), user_id(FK, indexed, RLS용 비정규화), master_item_id(FK), is_completed, assigned_date, completed_at, memo, created_at, updated_at

**property_photos** — 집 상태 사진

- id, move_id(FK, indexed), user_id(FK, indexed, RLS용 비정규화), photo_type(CHECK: move_in/move_out), room(CHECK), location_detail, group_key(입주/퇴실 비교 매칭용, 예: "거실-벽-좌측"), image_url, memo, taken_at, uploaded_at, created_at, updated_at, deleted_at(soft delete)

### 설계 판단

- user_id 비정규화: RLS가 단일 테이블 기준이라 JOIN 없이 권한 체크 필요
- soft delete: 보증금 분쟁 증거 사진 실수 삭제 방지
- CHECK 제약조건: 잘못된 값 원천 차단 (housing_type, status, photo_type 등)
- updated_at: 전 테이블. trigger로 자동 갱신
- 인덱스: FK 컬럼에 기본 인덱스
- group_key: 입주/퇴실 비교 뷰어(F5)에서 같은 위치 사진 매칭용

---

## 8. API 설계 (Supabase 쿼리 + RLS)

### 쿼리 목록

| 유저 플로우 | 함수명                  | 타입   | 설명                                        |
| ----------- | ----------------------- | ------ | ------------------------------------------- |
| Step 2      | createMoveWithChecklist | RPC    | 이사 생성 + 체크리스트 자동 생성 (트랜잭션) |
| Step 3      | getCurrentMove          | READ   | 현재 진행 중인 이사 조회                    |
| Step 3      | getTodayItems           | READ   | 오늘 할 일 + 과거 미완료 항목               |
| Step 3,4    | toggleChecklistItem     | WRITE  | 체크 토글 (낙관적 업데이트)                 |
| Step 4      | getTimelineItems        | READ   | 전체 체크리스트 (날짜별 그룹핑은 프론트)    |
| Step 5      | updateItemMemo          | WRITE  | 항목 메모 추가                              |
| Step 7      | uploadPhoto             | WRITE  | Storage 업로드 + DB 메타데이터 저장 (2단계) |
| Step 8      | getPhotosByMove         | READ   | 이사별 사진 목록 (방별 그룹핑은 프론트)     |
| —           | updateMove              | WRITE  | 이사 정보 수정                              |
| —           | softDeleteMove          | DELETE | 이사 soft delete                            |
| —           | softDeletePhoto         | DELETE | 사진 soft delete                            |

### 핵심 설계 판단

- createMoveWithChecklist를 RPC(Database Function)로 처리: 이사 생성 + 체크리스트 복사가 원자적 트랜잭션이어야 함. 클라이언트에서 순차 호출하면 중간 실패 시 불완전 데이터 발생
- 날짜 그룹핑을 프론트에서 처리: DB에서 GROUP BY 하면 UI 변경 시마다 쿼리 수정 필요. flat 리스트로 받아서 프론트에서 묶는 게 유연 (데이터 15-25개라 성능 이슈 없음)
- 낙관적 업데이트: toggleChecklistItem은 TanStack Query의 useMutation + onMutate로 UI 먼저 반영 → 실패 시 자동 롤백
- 사진 업로드 2단계: Storage에 파일 → DB에 메타데이터. taken_at은 오프라인 촬영 시점 보존 (증거력)
- 비회원 동작: Step 1~8은 IndexedDB로 로컬 동작. Step 9 가입 시 로컬 → 서버 마이그레이션

### RLS 정책

| 테이블                 | 정책                                        |
| ---------------------- | ------------------------------------------- |
| users                  | auth.uid() = id                             |
| moves                  | auth.uid() = user_id AND deleted_at IS NULL |
| master_checklist_items | SELECT: public (누구나 읽기 가능)           |
| user_checklist_items   | auth.uid() = user_id                        |
| property_photos        | auth.uid() = user_id AND deleted_at IS NULL |

---

## 9. 기술적 의사결정 기록 (ADR)

### ADR-001: Expo 선택 (vs Capacitor, vs 순수 RN)

- 결정: Expo (React Native)
- 이유: 앱스토어/플레이스토어 양쪽 배포 목표, EAS Build로 클라우드 빌드 가능
- 트레이드오프: 웹 버전 코드 공유 제한 (별도 React 웹앱 필요)

### ADR-002: React(Vite) 선택 (vs Next.js)

- 결정: React + Vite
- 이유: WebView 안에서 동작하는 SPA라 SSR 불필요. 서버 컴포넌트/클라이언트 컴포넌트 구분 같은 불필요한 복잡도 제거. Supabase 클라이언트 SDK로 직접 통신하니 API Routes 불필요. Vite 빌드가 빠르고 정적 파일 결과물이라 배포 유연
- 트레이드오프: SEO 없음 (WebView 안이라 필요 없음). 랜딩 페이지가 필요하면 별도 Next.js 앱 추가 (모노레포)

### ADR-003: Supabase 선택 (vs Firebase)

- 결정: Supabase
- 이유: PostgreSQL 기반으로 관계형 데이터(유저↔이사↔체크리스트)에 자연스러움. RLS로 보안 처리. Auth+Storage 통합. SQL 기반이라 면접에서 DB 설계 설명 용이
- 트레이드오프: Firebase 대비 실시간 기능 약간 제한 (이 앱에서는 불필요)

### ADR-004: 오프라인 전략 — IndexedDB + 동기화

- 결정: 핵심 기능(사진 촬영, 체크리스트) 오프라인 동작
- 이유: 이사 당일 새 집에 인터넷 없는 시나리오 대응. 서비스 핵심 순간에 못 쓰면 치명적
- 구현: Service Worker(캐싱) + IndexedDB(데이터/사진 저장) + 온라인 복귀 시 자동 동기화

### ADR-005: 상태관리 분리 — TanStack Query + Zustand

- 결정: 서버 상태는 TanStack Query, 클라이언트 상태는 Zustand
- 이유: 서버 데이터(체크리스트, 사진)는 캐싱, 낙관적 업데이트, 백그라운드 리페칭이 필요하고, UI 상태(모달, 현재 이사 ID)는 불필요. 하나의 도구로 둘 다 관리하면 역할이 뒤섞임
- 트레이드오프: 라이브러리 2개 학습 필요. 하지만 둘 다 API가 작아서 학습 비용 낮음

### ADR-006: 서비스 레이어 패턴 (과도한 추상화 지양)

- 결정: services/ 폴더에 순수 함수로 분리. Interface/Repository 패턴은 미사용
- 이유: 관심사 분리(데이터 호출 vs 상태 관리 vs UI)가 주 목적. 구현체가 Supabase 하나뿐이라 Interface는 불필요한 추상화. "2번 이상 쓰이는가?" 기준으로 분리 판단
- 트레이드오프: 백엔드 교체 시 Interface가 없어서 서비스 함수 내부를 직접 수정해야 함. 하지만 그 시점에 추상화해도 늦지 않음

### ADR-007: Vite 선택 (vs CRA)

- 결정: Vite
- 이유: CRA는 2023년에 유지보수 중단. 공식 React 문서에서도 비추천. 2025-2026년 기준으로 React SPA의 표준 빌드 도구가 Vite. CRA를 쓰면 면접에서 "deprecated된 도구를 왜 썼나" 질문 가능
- 비교 대상이 아님: CRA vs Vite 비교가 아니라, CRA가 선택지에서 이미 빠진 상태

### ADR-008: Supabase 확장성 판단

- 결정: MVP~MAU 1만 수준까지 Supabase 유지. 그 이상은 그때 판단
- 근거: 이사 앱 특성상 유저당 데이터 매우 작음 (체크리스트 20개 + 사진 10-20장). Supabase Free(500MB DB, 1GB Storage)로 MVP 충분. Pro($25/월)면 MAU 1만도 커버
- Supabase 한계가 오는 시점: 복잡한 백그라운드 잡, 커스텀 인증 플로우, 대량 외부 API 연동 등이 필요해질 때. 이때 서비스 레이어 패턴(ADR-006) 덕분에 교체 비용 최소화 가능

---

## 10. 검토 이력

### ChatGPT 코드리뷰 반영 (API/스키마)

| 항목                    | 판단        | 이유                                                                |
| ----------------------- | ----------- | ------------------------------------------------------------------- |
| 1. 조건을 JSONB로       | 미반영      | text[] 배열이 단순 포함 여부 체크에 더 적합. JSONB는 오버엔지니어링 |
| 2. assigned_date 추가   | 이미 반영됨 | 스키마에 이미 존재                                                  |
| 3. 낙관적 업데이트 대비 | 이미 반영됨 | updated_at 추가 완료. 충돌/롤백은 TanStack Query로 처리             |
| 4. API 네이밍 통일      | 반영        | toggleCheckItem→toggleChecklistItem, getActiveMove→getCurrentMove   |
| 5. group_key 추가       | 반영        | property_photos에 group_key 추가 (입주/퇴실 비교 매칭용)            |
| 6. soft delete 보완     | 이미 반영됨 | created_at, updated_at 전 테이블 추가 완료                          |

### ChatGPT 리뷰 반영 (체크리스트 메타데이터)

| 항목                       | 판단              | 이유                                                                             |
| -------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| 1. priority + is_mandatory | 반영 (단순화)     | is_skippable: boolean으로 필수/선택 2단계. 3단계 우선순위는 이 규모에서 오버     |
| 2. duration_estimate       | 미반영            | 사람/상황마다 달라 부정확한 수치가 오히려 혼란. 체크리스트 앱이지 캘린더 앱 아님 |
| 3. order                   | 이미 반영됨       | sort_order 컬럼 이미 존재                                                        |
| 4. requires 환경 조건      | 미반영            | 온보딩 질문 증가 → 이탈률 상승. 가이드 안에서 분기 안내가 더 적절                |
| 5. guide_type              | 반영              | tip/warning/critical로 UI 강조 차등. 중요 항목 시각적 부각                       |
| 6. reminder_level          | 미반영 (시기상조) | 알림 기능(F3)이 MVP에 없음. v1.1에서 함께 설계                                   |
| 7. reward_point            | 미반영            | 이사 체크리스트는 게이미피케이션과 안 맞음. 체크 만족감 + 진행률 바로 충분       |

---

## 11. 다음 단계 (TODO)

- [ ] 마스터 체크리스트 데이터 구체화 (40-50개 항목)
- [ ] 폴더 구조 + 프로젝트 초기 세팅
- [ ] UI 와이어프레임 / 디자인
- [ ] Supabase 프로젝트 생성 + DB 마이그레이션
- [ ] 개발 시작
