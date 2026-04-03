# 프로젝트 상태

> 마지막 업데이트: 2026-04-03

## 현재 단계

2단계: 온보딩 — 구현 중 (디자인 리팩토링 완료)

## 완료된 것

### 1단계: Supabase 세팅

- supabase/migrations/00001~00004: 테이블, RPC, RLS, Storage
- supabase/seed.sql: 마스터 체크리스트 46개
- apps/web/src/lib/supabase.ts: 클라이언트 초기화
- packages/shared/src/types/database.ts: Supabase 타입
- docs/specs/01-supabase-setup.md, 01-verify.md

### 2단계: 온보딩 (구현 완료, 디자인 리팩토링 완료)

- 온보딩 3스텝 폼: StepMovingDate, StepHousingType, StepContractAndMove
- CalendarPicker, HousingTypeGrid, SelectionChip, CheckTip 컴포넌트
- OnboardingPage (라우트 + ProgressBar + 뒤로가기)
- useCreateMove 훅 + move 서비스
- onboardingStore (Zustand)
- LandingPage, DashboardPage (플레이스홀더)

### 디자인 시스템 리팩토링 (2026-04-03)

- **타이포 토큰**: `@theme`에 `--text-h1`~`--text-caption` 6개 등록, `text-[26px]` 임의값 → `text-h1` 토큰으로 전환
- **Button**: danger variant 추가, shadow-sm, 사이즈별 스펙 맞춤, active pressed 파생색, cn() 적용
- **SelectionChip**: h-10 고정, rounded-lg, border-border-input, icon/onSelect prop, cn() 적용
- **ProgressBar**: 높이 4px, bg-border, duration-300
- **HousingTypeGrid**: 비균일 카드 레이아웃 (왼쪽 원룸+투룸, 오른쪽 3개 균일), shadow 제거
- **CheckTip**: 장식 아이콘 제거, 연한 배경 + 텍스트만
- **StepContractAndMove**: 칩에 아이콘 추가 (CreditCard/House/Truck/PackageOpen/PackageCheck/Car), rounded-2xl 통일, flex-col 세로 배치
- **OnboardingFooter**: 하단 CTA 공통 컴포넌트 추출, 상단 블러 그라데이션
- **세로 반응형**: 콘텐츠 스크롤 + 하단 CTA fixed 패턴 (작은 화면 대응)
- **design-style-guide.md**: 타이포 토큰 섹션 추가

## 진행 중인 것

- 없음

## 다음 할 것

- 2단계 스펙 검증 (`/verify`)
- 3단계 구현: 대시보드 + 타임라인 + 설정

## 알려진 문제

- 없음

## 실패한 접근 (반복 금지)

- RPC 권한 체크에 `!=` 사용 금지 — auth.uid()가 NULL일 때 가드 스킵됨. 반드시 `IS DISTINCT FROM` 사용
- Tailwind v4 font-size 토큰: `--font-size-*`가 아니라 `--text-*` 네임스페이스 사용해야 `text-h1` 유틸리티가 생성됨
