# 4단계 검증 결과 — 항목 상세 + 체크 토글 + 메모

> 검증일: 2026-04-13

## 완료 확인 기준 결과

### 빌드/DB

- [x] 마이그레이션 파일 존재 (00005_guide_structure.sql, 00006_seed_guide_structure.sql)
- [x] 시드: 46개 항목 guide_steps/items/note (00006 마이그레이션)
- [x] `pnpm build` — 성공 (2.19s, 2862 modules)
- [x] `pnpm lint` — 에러 0
- [x] `use-debounce` ^10.1.1 설치 확인

### 라우팅/진입

- [x] ChecklistDetailPage + `/checklist/:itemId` 라우트
- [x] 대시보드/타임라인에서 클릭 → 상세 이동

### DetailHeader

- [x] 카드 박스 없음, D-day 트럭 칩 + 배지, text-h1 제목, 상대일자
- [x] 과거 항목: 칩 숨김 + "지금 해도 괜찮아요"

### 가이드 섹션

- [x] GuideStepsSection (Toss Stepper), Steps+Note TipCard 병합
- [x] GuideItemsSection (로컬 체크 토글)
- [x] GuideNoteSection (Steps 없을 때 독립 TipCard)
- [x] RelatedLinkCard (바로가기 + Globe)

### 메모

- [x] "내 메모", auto-resize textarea, 디바운스 1s, blur 즉시 저장, 스피너/저장됨 피드백

### 완료 CTA / 스탬프

- [x] CompletionToggleButton sticky, CompletionStamp 오버레이

### 레이아웃

- [x] SectionDivider(8px), pb-28

### 토스트

- [x] ToastProvider 도입, 3단계 훅(useToggleItem, useUpdateMove)에 toast.error 적용

### 스켈레톤/에러

- [x] 로딩/에러 상태 처리

### 접근성

- [x] aria-pressed/aria-label/role 적용

### 테스트

- [x] `pnpm test` — shared 5/5 통과

## 누락

- 없음

## 스코프 크립

- 없음 (스펙의 "4단계 폴리싱" 범위 내)

## 컨벤션 위반

- 없음

## Codex 코드리뷰 결과

- **[P1] MemoSection 자동저장 경쟁상태** — `apps/web/src/features/checklist-detail/components/MemoSection.tsx:27-30`
  디바운스 저장이 mutate 즉시 호출 → 병렬 요청 시 오래된 응답이 최신을 덮어쓸 가능성. Queue/supersede 필요. **→ 수정 완료 (2026-04-13)**
  - 수정 방법: `inFlightRef`(진행 중 플래그) + `pendingRef`(대기 중인 최신 값) ref 2개 도입
  - 저장 요청이 들어왔을 때 이미 진행 중이면 `pendingRef`에 최신 값만 덮어쓰고 네트워크 호출은 스킵
  - `onSuccess`에서 `pendingRef`가 있으면 그 값으로 재귀 호출 → 항상 "마지막 값"만 서버 상태가 됨
  - `onError`에서는 두 ref 모두 초기화해 다음 입력부터 정상 흐름 복귀
- **[P2] assignedDate UTC 파싱 버그** — `apps/web/src/features/checklist-detail/components/DetailHeader.tsx:39`
  `new Date('YYYY-MM-DD')`는 UTC로 파싱되어 UTC- 타임존에서 하루 밀림 → D-day 잘못 계산. `parseISO` 등 로컬 파싱 필요. `formatDateKorean`도 동일 이슈. **→ 수정 완료 (2026-04-13)**
  - 수정 방법: `packages/shared/src/utils/dateLabel.ts`에 `parseLocalDate(YYYY-MM-DD)` 헬퍼 추가 (`'-'` split → `new Date(y, m-1, d)` 로컬 생성자 사용)
  - `packages/shared/src/index.ts`에서 `parseLocalDate` export 추가
  - `DetailHeader.tsx`의 `differenceInCalendarDays(new Date(assignedDate), ...)` → `differenceInCalendarDays(parseLocalDate(assignedDate), ...)`로 교체
  - `formatDateKorean`도 내부적으로 `parseLocalDate` 사용하도록 변경 → 요일/월/일 표시까지 타임존 영향 제거
  - 재검증: `pnpm build` / `pnpm lint` / `pnpm test` 모두 통과

## 종합 판정

✅ **통과 (수정 반영 후)**

원래 판정: ❌ 수정 필요 (P1/P2 2건)
→ 2건 모두 수정 완료. 빌드/린트/테스트/스펙 체크리스트 전부 통과. 머지 가능 상태.
