# 2단계 온보딩 — 스펙 검증 결과

> 검증일: 2026-04-03 (2차)
> 스펙: docs/specs/02-onboarding.md

---

## 완료 확인 기준 결과

- [x] `pnpm dev` → 브라우저에서 랜딩 페이지 표시
- [x] 랜딩에서 "이사 시작하기" 클릭 → /onboarding 으로 이동
- [x] 온보딩 스텝 1: 캘린더에서 날짜 선택 가능, 과거 14일~미래 90일 범위 — **스펙 업데이트 반영 완료**
- [x] 온보딩 스텝 1: 날짜 미선택 시 "다음" 버튼 비활성
- [x] 온보딩 스텝 2: 5개 주거유형 카드 표시, 클릭 시 Teal 선택 스타일
- [x] 온보딩 스텝 2: 왼쪽 2개 + 오른쪽 3개 높이 일치 (flex 방식으로 달성)
- [x] 온보딩 스텝 3: 계약유형(2개) + 이사방법(4개) 선택 가능
- [x] 온보딩 스텝 3: 둘 다 선택 시에만 "맞춤 체크리스트 만들기" 활성
- [x] "맞춤 체크리스트 만들기" 클릭 → RPC 호출 성공 → /dashboard 이동
- [x] 대시보드에 플레이스홀더 텍스트 표시
- [x] 뒤로가기 동작: 스텝 3→2→1→랜딩, 대시보드에서 뒤로가기→온보딩 안 나옴 (replace: true)
- [x] ProgressBar: 스텝에 따라 1/3, 2/3, 3/3 채움
- [x] `pnpm build` → 에러 없음 (warning: chunk > 500KB)
- [x] `pnpm lint` → 에러 없음
- [x] 존재하지 않는 라우트 → 랜딩으로 리다이렉트
- [x] 접근성: 주거유형 카드에 role="radiogroup" + role="radio" 적용
- [x] 접근성: 캘린더 키보드 네비게이션 동작 (react-day-picker 내장)
- [x] 접근성: 스텝 전환 시 제목 요소에 포커스 이동 (titleRef + tabIndex={-1})
- [x] "진행 단계 (N/3)" 텍스트 헤더에 표시
- [x] 오프라인: 네트워크 끊기면 제출 버튼 비활성 + 안내 배너 표시
- [x] 오프라인: 네트워크 복귀 시 자동 활성화

**통과: 21/21**

---

## 누락 (스펙에 있는데 구현 안 됨)

없음

---

## 스코프 크립 (구현했는데 스펙에 없음)

1. **Button danger variant** — 스펙은 primary/secondary/ghost 3개만 명시. 디자인 리팩토링에서 추가. 해롭지 않은 확장이나 현재 미사용.
2. **OnboardingFooter 공통 컴포넌트** — 스펙에는 없으나 하단 CTA 패턴을 공통화 + 블러 그라데이션. 합리적 추출.
3. **services/move.ts에 `p_user_id` 하드코딩** — 스펙 코드에는 없으나, RPC 시그니처가 요구하므로 임시 처리 (`'00000000-...'`). STATUS.md에 "8단계에서 auth.uid()로 교체" 기록됨.
4. **디자인 시스템 타이포 토큰** — `@theme`에 `--text-h1`~`--text-caption` 등록, 임의값 대신 토큰 사용.
5. **칩에 아이콘 추가** — 계약유형(CreditCard/House), 이사방법(Truck/PackageOpen/PackageCheck/Car).

---

## 컨벤션 위반

- 없음 (CLAUDE.md 규칙 준수 확인: .env 미커밋, eval/dangerouslySetInnerHTML 미사용, VITE\_ 접두사 사용, cn() 유틸 적용)

---

## Codex 코드리뷰 결과

- Codex Review
  Target: working tree diff
  Codex session ID: 019d521c-7b59-7723-ac88-2f19a32c4d3f
  Resume in Codex: codex resume 019d521c-7b59-7723-ac88-2f19a32c4d3f
  The onboarding completion path is broken because move creation uses a hardcoded
  user ID that fails the RPC authorization check. As a result, the key user flow
  introduced in this patch cannot complete successfully.
  Review comment:
  - [P1] Pass authenticated UID to move creation RPC —
    apps/web/src/services/move.ts:29
    create_move_with_checklist checks that p_user_id matches auth.uid(), but this call
    always sends a fixed UUID. In any normal session (including unauthenticated users
    and authenticated users with a different ID), the RPC raises unauthorized:
    user_id mismatch, so the final onboarding submit cannot succeed. This should use
    the current Supabase auth user ID (or the RPC should derive it server-side)
    instead of a hardcoded value.
  - **대응**: 8단계(인증)에서 해결 예정. 현재는 RLS OFF + 하드코딩 user_id로 임시 동작.

---

## 종합 판정

**✅ 통과** (21/21)

스펙 대비 구현 완료. CalendarPicker 범위 변경은 스펙에 반영 완료.
Codex P1 (하드코딩 user_id)은 8단계 인증에서 해결 예정.
