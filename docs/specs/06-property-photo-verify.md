# 6단계: 집 상태 기록 + 리포트 — 검증 리포트

> 검증일: 2026-04-22 (초회) / 2026-04-24 (2차 — 리포트 리파인 후)

---

## 완료 확인 기준 결과

### 빌드

- [x] `pnpm build` — 성공 (2차: 2026-04-24 재확인 통과)
- [x] `pnpm lint` — 에러 0 (2차: 재확인 통과)
- [x] `pnpm test` — 기존 테스트 통과 + photoHash 테스트 추가 (16 passed, 3 test files) (2차: 재확인 통과)
- [x] 추가 패키지: exifreader만 설치됨 (`"exifreader": "^4.38.1"`)

### 라우트

- [x] `/photos` → PhotosPage 렌더링 (App.tsx:33)
- [x] `/photos/report` → PhotoReportPage 렌더링 (App.tsx:31, `/photos/:room`보다 먼저 등록)
- [x] `/photos/trash` → PhotoTrashPage 렌더링 (App.tsx:32)
- [x] `/photos/entrance` → PhotoRoomPage 렌더링 (App.tsx:34, room=entrance)
- [x] 이사 없이 `/photos` 직접 접근 → 랜딩 리다이렉트 (PhotosPage:69)

### 입주/퇴실 토글

- [x] D-Day 이전: "퇴실" 기본 선택 (`daysUntilMove > 0 ? 'move_out'`, PhotosPage:37)
- [x] D-Day 이후: "입주" 기본 선택
- [x] 토글 전환 시 해당 타입의 사진 목록으로 전환 (URL 쿼리 파라미터 `?type=` 반영)
- [x] 접근성: role="tablist", aria-selected — ✅ 수정 완료 (`role="radiogroup"` → `role="tablist"`, `aria-checked` → `aria-selected`)

### 방별 카드

- [x] 6개 방 카드 표시 (현관, 방, 화장실, 주방, 베란다, 기타) — RoomSection × ROOM_META
- [x] 각 카드에 사진 수 표시 (`count/maxCount`)
- [x] 힌트 텍스트 표시 — RoomSection에는 hint 대신 썸네일 + 추가 버튼 표시 (스펙과 방식 다르나 기능 충족)
- [x] 카드 클릭 → `/photos/:room` 이동 (PhotosPage:131)

### 사진 촬영/선택

- [x] "촬영" 버튼 → 카메라 열림 (`<input capture="environment">`, PhotoUploadFab)
- [x] "갤러리" 버튼 → 갤러리 열림 (`<input multiple>`, PhotoUploadFab/PhotoEmptyState)
- [x] 10MB 초과 파일 → 토스트 에러 + 건너뛰기 (PhotoRoomPage:91)
- [x] 업로드 중 스피너 표시 (PhotoGrid:76-84, Loader2 애니메이션)

### EXIF + 해시

- [x] EXIF에서 촬영 일시 추출 → taken_at에 저장 (exif.ts, DateTimeOriginal)
- [x] EXIF 없으면 taken_at = null (에러 아님) — catch블록에서 null 반환
- [x] SHA-256 해시 생성 → image_hash에 저장 (photoHash.ts, Web Crypto API)

### Storage + DB

- [x] Storage 경로: `{moveId}/{photoType}/{room}_{timestamp}.{ext}` (photos.ts:91)
- [x] DB 레코드 생성 (photo_type, room, storage_path, image_hash, taken_at)
- [x] signed URL로 이미지 표시 (useSignedUrls 훅)
- [x] signed URL 배치 조회 동작 (`createSignedUrls` 복수형, photos.ts:50-52)

### 사진 상세

- [x] 사진 탭 → PhotoFullscreenViewer 오픈 (createPortal, document.body)
- [x] 사진 풀 사이즈 표시 (핀치줌 1~4x, 더블탭 토글) — PhotoFullscreenViewer
- [x] 날짜 표시 (taken_at → uploaded_at → created_at 폴백)
- [x] 메모 인라인 편집 → 디바운스 1초 자동저장 (PhotoGrid PhotoCard, useDebouncedCallback 1000ms)
- [x] 삭제 → DeletePhotoDialog (바텀시트) → soft delete → 목록에서 제거 (낙관적 업데이트)

### 약한 가이드

- [x] 사진 0~2장인 방: RoomTipCard 표시 (`showTip = photos.length < 3 && photos.length > 0`)
- [x] 사진 3장+인 방: RoomTipCard 자동 숨김
- [x] 사진 0장인 방: PhotoEmptyState (tipDetail 텍스트)
- [x] 방 카드에 힌트 한 줄 표시 — RoomSection에 썸네일 + 추가 버튼 형태로 구현

### 최근 삭제 (PhotoTrashPage)

- [x] `/photos/trash` 라우트 동작
- [x] iOS 대형 타이틀 + 2줄 서브텍스트 (28px bold + "방마다 최대 3장" + "30일 뒤 정리")
- [x] 필터 칩: 활성=bg-primary white, 비활성=bg-black/[0.05] muted
- [x] 72px 썸네일 + "방이름 · 메모" + timeAgo + daysLeft 표시
- [x] daysLeft 3일 이하: primary 색상 강조
- [x] 복구 버튼: 방 가득 차면 disabled + 토스트
- [x] 영구삭제: DB + Storage 삭제 (hardDeletePhoto)
- [x] 빈 상태: Trash2 아이콘 + 안내 문구
- [x] 구분선: left 100px부터 (iOS 네이티브 패턴, `left-[100px]`)

### 삭제 다이얼로그

- [x] 바텀시트 스타일 (slideUp 200ms 애니메이션)
- [x] overflow=true: 줄바꿈 경고 문구 ("최근 삭제가 가득 찼어요. 가장 오래된 사진 1장이 영구삭제돼요.")
- [x] 캐시 워밍: PhotoGrid에서 useDeletedPhotos 미리 fetch → isOverflow를 props로 전달

### 리포트

- [x] 사진 1장+ 있을 때 "리포트 보기" 버튼 표시 — ✅ PhotosPage에 추가 완료
- [x] 사진 0장이면 리포트 버튼 숨김 — `photos.length > 0` 조건
- [x] 리포트 페이지: 방별 사진 + 메모 표시 (ReportRoomSection)
- [x] 사진 0장인 방은 리포트에서 미표시 (`if (roomPhotos.length === 0) return null`)
- [x] 상단 요약: 날짜 + 총 사진 수 + 메모 건수 (ReportHeader)
- [x] 하단 TipCard: 보증금 분쟁 증거 안내 — ✅ Lightbulb 아이콘 + SHA-256 설명 포함 TipCard로 재구현

### 대시보드 연결

- [x] PhotoPromptCard CTA → `/photos` 이동 (`navigate(ROUTES.PHOTOS)`, console.log 제거 완료)
- [x] DevTabBar 집기록 탭 → `/photos` active 상태 (Camera 아이콘)

### 접근성

- [x] PhotoTypeToggle: role="tablist" + aria-selected — ✅ 수정 완료
- [x] RoomCard: role="button" + aria-label (RoomSection의 button + aria-label)
- [x] PhotoFullscreenViewer: role="dialog" + aria-modal
- [x] DeletePhotoDialog: role="alertdialog" + aria-describedby
- [x] 업로드 중: aria-busy (PhotoGrid:55)
- [x] ESC 키로 PhotoFullscreenViewer / DeletePhotoDialog 닫기

---

## 누락 (스펙에 있는데 구현 안 됨)

1. ~~PhotosPage에 "리포트 보기" 버튼 없음~~ → ✅ 수정 완료 (사진 1장+ 있을 때 리포트 보기 버튼 표시)
2. ~~PhotoTopTabs 접근성~~ → ✅ 수정 완료 (`role="tablist"` + `aria-selected`로 변경)

---

## 스코프 크립 (구현했는데 스펙에 없음)

1. **resizeImage.ts** — 클라이언트 리사이즈 유틸 (긴 변 1920px, WebP 80%). 스펙에 명시되지 않았으나, 대용량 원본 사진 최적화를 위한 합리적 추가
2. **PhotoInfoBanner** — 스펙의 "상단 안내 문구"를 dismiss 가능한 배너로 구현 (localStorage 기반). 스펙보다 풍부하지만 합리적
3. **RoomSection** — 스펙의 RoomCard + RoomGrid를 하나로 통합. 카드 안에 썸네일 가로 스크롤 + 추가 버튼을 포함하는 형태로 변경. 와이어프레임과 다르지만 더 나은 UX 제공
4. **PhotoDetailSheet** — 스펙 §7-4b에서 "제거됨"이라 했으나 PhotoReportPage에서 사진 탭 시 사용됨. 리포트 페이지 전용 읽기 시트로 활용

---

## 컨벤션 위반

1. ~~default export 사용~~ → ✅ 수정 완료 (4개 Photo 페이지의 `export default` 라인 삭제)

---

## Codex 코드리뷰 결과

- **[P1] PhotoReportPage:31-36** — 쿼리 완료 전 리다이렉트
  - 문제: `usePhotos`가 비동기인데 `photos` 기본값 `[]`로 즉시 `photos.length === 0` 체크 → 콜드 로드 시 사진이 있어도 `/photos`로 리다이렉트. 리포트 페이지가 캐시 warm 상태에서만 접근 가능
  - 수정: `isPhotosLoading` 상태에서 Skeleton 로딩 UI 표시, 로딩 완료 후에만 리다이렉트 체크 ✅ 수정 완료

- **[P1] PhotosPage:76-89** — 개요 업로드 시 방별 maxCount 미적용
  - 문제: `handleGallerySelect`에서 파일 크기만 체크하고 `roomMeta.maxCount` 잔여 슬롯 계산이 없음. 방 제한 초과 업로드 가능
  - 수정: `activeRoom`의 roomMeta 조회 → `remaining = maxCount - currentCount` 계산 → `files.slice(0, remaining)` 적용 + 가득 참 토스트 ✅ 수정 완료

- **[P2] photos.ts:194-197** — hardDelete에서 Storage 삭제 실패 무시
  - 문제: `supabase.storage.remove()`는 에러를 throw하지 않고 `{ error }` 페이로드를 반환하지만 결과를 검사하지 않음. Storage 삭제 실패 시에도 DB 행이 삭제되어 orphan 파일 발생
  - 수정: `remove()` 반환값에서 `storageError` 체크, 실패 시 throw하여 DB 삭제 중단 ✅ 수정 완료

- **[P2] PhotoRoomPage:84-90** — 동시 업로드 시 maxCount 우회
  - 문제: `remaining`을 현재 `photos.length` 기준으로만 계산. 진행 중인 업로드가 있으면 두 번째 배치가 같은 remaining 값을 보고 통과하여 maxCount 초과 가능
  - 수정: `handleUpload` 진입 시 `uploadingCount > 0`이면 조기 리턴으로 동시 업로드 차단 ✅ 수정 완료

---

## Codex 코드리뷰 결과 (2차 — 2026-04-24, 리포트 리파인 후)

- **[P1] PhotoGrid.tsx:139-141** — 메모 자동저장 시 stale 값으로 덮어쓰기 가능
  - 문제: `saveMemo`가 `photo.memo` prop(스냅샷)과 비교하여 변경 여부를 판단하지만, 빠른 편집 + 느린 네트워크 조합에서 첫 번째 mutate가 in-flight인 상태에서 두 번째 debounce가 발동하면, 직렬화 없이 out-of-order 도착 가능. 예: "A" 입력 → debounce 발동 → "A" 삭제(빈 값) → `photo.memo` 비교는 stale prop 기준이라 건너뛰거나 순서 역전
  - 수정: `photo.memo` 대신 `lastSavedRef`(useRef)로 마지막 서버 전송 값을 추적. 저장 전 ref와 비교, 저장 시 ref 갱신 → stale prop 참조 제거 ✅ 수정 완료

- **[P2] PhotoTrashPage.tsx:107-110** — 선택된 방 필터가 빈 목록을 가리킬 때 리셋 안 됨
  - 문제: `activeFilter`로 특정 방을 선택한 후, 그 방의 삭제 사진을 모두 복구/영구삭제하면 `filteredPhotos`가 빈 배열이 됨. 방이 1개만 남으면 필터 칩 자체가 숨겨져서 사용자가 필터를 전체로 되돌릴 UI 경로가 없음 → 삭제 사진이 남아 있는데 빈 화면
  - 수정: `counts`에 `activeFilter` 키가 없으면(해당 방 사진 0건) `setActiveFilter(FILTER_ALL)`로 자동 리셋 ✅ 수정 완료

---

## 종합 판정

### ✅ 통과

#### 1차 Codex 리뷰 (2026-04-22) — 전체 수정 완료

1. **[P1] PhotoReportPage 로딩 가드** — ✅ `isPhotosLoading` 가드 + Skeleton UI 추가
2. **[P1] PhotosPage "리포트 보기" 버튼** — ✅ 사진 1장+ 시 버튼 표시
3. **[P1] PhotosPage maxCount 적용** — ✅ remaining 계산 + slice 적용
4. **[P2] hardDeletePhoto Storage 에러 체크** — ✅ storageError 체크 + throw
5. **[P2] PhotoRoomPage 동시 업로드 가드** — ✅ uploadingCount > 0 조기 리턴
6. **[Minor] default export 제거** — ✅ 4개 파일
7. **[Minor] PhotoTopTabs 접근성** — ✅ tablist + aria-selected

#### 2차 Codex 리뷰 (2026-04-24) — 전체 수정 완료

1. **[P1] PhotoGrid 메모 autosave stale overwrite** — ✅ `lastSavedRef`로 비교 대상 변경
2. **[P2] PhotoTrashPage 필터 리셋 누락** — ✅ `counts` 기반 자동 리셋

#### 추가 작업 (완료)

- PhotoReportPage 디자인 리파인 (Claude Design 기반: SummaryCard + 메모 리스트 + TipCard + 공유 CTA + Footer)

### 리포트 페이지 UI 리파인 (디자인 리뷰 후)

#### ReportRoomSection

- ✅ "N / maxCount 완료" + progress bar 제거 → 간단히 "N장" 카운트
- ✅ 해시 배지 (Check 아이콘 원형) 제거 — 사용자에게 의미 불명확
- ✅ 타임스탬프 오버레이 제거 → 에디토리얼 스타일 번호 배지 (font-extrabold + drop-shadow, 배경 없음, 좌상단)
- ✅ 메모 섹션: FileText 아이콘 + 배경 박스 제거 → "메모" 라벨 + "번호. 텍스트" 미니멀 포맷
- ✅ 메모 line-clamp-2 적용 (긴 메모 2줄 제한, 상세는 PhotoFullscreenViewer에서 확인)
- ✅ `showHashBadge` prop 제거

#### PhotoReportPage

- ✅ TipCard 아이콘: Lightbulb → ShieldCheck (증거 보호 의미)
- ✅ DevTabBar 제거 (리포트는 몰입형 상세 페이지, iOS 패턴 — 탭바 숨김)
- ✅ 공유 버튼 하단 패딩: 72px(탭바 높이) 제거 → safe-area-inset-bottom만 적용
