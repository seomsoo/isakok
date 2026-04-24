# 6단계: 집 상태 기록 + 리포트 스펙 (SDD)

> 목표: 입주/퇴실 시 집 상태를 방별로 사진 촬영·저장하고, 요약 리포트로 확인할 수 있는 기능 제공
> 이 단계가 끝나면: 집기록 탭에서 입주/퇴실 사진 촬영·갤러리 선택·메모·삭제가 가능하고, 리포트 페이지에서 방별 요약을 확인할 수 있는 상태

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- 집기록 탭 메인 페이지 (`/photos`) — 입주/퇴실 토글 + 방별 카드 리스트
- 방별 사진 상세 페이지 (`/photos/:room`) — 사진 추가/조회/메모/삭제
- 리포트 페이지 (`/photos/report`) — 방별 사진 요약 읽기 전용
- 사진 촬영: 웹 `<input capture>` (카메라 직접) + `<input multiple>` (갤러리 여러 장)
- EXIF 메타데이터 추출 (촬영 일시 — GPS는 이번 단계 제외)
- SHA-256 해시 생성 (원본 무결성 증거)
- Supabase Storage 업로드 + DB 메타데이터 저장 (2단계 프로세스, moveId 기반 경로)
- signed URL 생성 (private 버킷)
- 사진 개별 메모 (선택 사항)
- 사진 soft delete
- 대시보드 PhotoPromptCard CTA 실제 연결 (`/photos`로 이동)
- 방별 약한 가이드 (카드 힌트, TipCard, EmptyState 유도 문구)
- 서비스 함수: `uploadPhoto`, `getPhotosByMove`, `softDeletePhoto`, `getSignedUrl`
- TanStack Query 훅: `usePhotos`, `useUploadPhoto`, `useDeletePhoto`

### 안 하는 것

- AI 맞춤 가이드 (7단계)
- 가입 유도 팝업 (8단계 — `console.log('TODO: 가입 유도')` placeholder만)
- 입주/퇴실 비교 뷰어 (v1.1 — F5)
- PDF 리포트 생성 (v1.1)
- 이메일 전송 (v1.1)
- 네이티브 카메라 (9단계 — Expo 셸에서 풀 EXIF + 네이티브 카메라 API)
- 오프라인 촬영 + 동기화 큐 (8단계 이후 — IndexedDB 큐 구현은 인증 완료 후)
- 사진 편집/크롭 (앱 스코프 밖)

---

## 1. 폴더 구조 (이 단계에서 생성/수정하는 파일)

```
apps/web/src/
├── App.tsx                                    ← 수정 (라우트 3개 추가)
│
├── pages/
│   ├── PhotosPage.tsx                         ← 생성 (집기록 탭 메인)
│   ├── PhotoRoomPage.tsx                      ← 생성 (방별 사진 상세, iOS 대형 타이틀)
│   ├── PhotoReportPage.tsx                    ← 생성 (리포트 페이지)
│   └── PhotoTrashPage.tsx                     ← 생성 (최근 삭제 — 복구/영구삭제)
│
├── features/
│   └── photos/
│       ├── components/
│       │   ├── PhotoTypeToggle.tsx             ← 생성 (입주/퇴실 세그먼트 컨트롤)
│       │   ├── RoomCard.tsx                    ← 생성 (방별 카드 — 썸네일 + 힌트 + 카운트)
│       │   ├── RoomGrid.tsx                    ← 생성 (6개 방 카드 그리드)
│       │   ├── PhotoGrid.tsx                   ← 생성 (PhotoCard 리스트 + 타임스탬프 + 인라인 메모 + ⋯ 메뉴)
│       │   ├── PhotoFullscreenViewer.tsx       ← 생성 (createPortal 풀스크린 뷰어, 핀치줌)
│       │   ├── DeletePhotoDialog.tsx           ← 생성 (바텀시트 삭제 확인, overflow 경고)
│       │   ├── PhotoUploadFab.tsx              ← 생성 (우하단 FAB — 갤러리/촬영 토글)
│       │   ├── RoomTipCard.tsx                 ← 생성 (토스 스타일 — Lightbulb 아이콘 + 연한 bg)
│       │   ├── PhotoEmptyState.tsx             ← 생성 (사진 없을 때 유도 문구 + CTA 버튼)
│       │   ├── DeletedPhotosSection.tsx        ← 생성 (최근 삭제 관련)
│       │   ├── ReportHeader.tsx                ← 생성 (리포트 상단 요약)
│       │   └── ReportRoomSection.tsx           ← 생성 (리포트 방별 섹션)
│       └── hooks/
│           ├── usePhotos.ts                    ← 생성 (사진 목록 조회)
│           ├── useUploadPhoto.ts               ← 생성 (업로드 뮤테이션)
│           ├── useDeletePhoto.ts               ← 생성 (soft delete 뮤테이션 + 최근삭제 overflow 처리)
│           ├── useDeletedPhotos.ts             ← 생성 (방별 삭제 사진 조회)
│           ├── useRestorePhoto.ts              ← 생성 (삭제 사진 복구 뮤테이션)
│           ├── useUpdatePhotoMemo.ts           ← 생성 (메모 자동저장 뮤테이션)
│           ├── useSignedUrls.ts                ← 생성 (배치 signed URL 조회)
│           └── queryKeys.ts                    ← 생성 (photos 쿼리 키 — deleted, allDeleted 포함)
│
├── services/
│   └── photos.ts                              ← 생성 (사진 CRUD + Storage)
│
├── features/
│   └── dashboard/
│       └── components/
│           └── PhotoPromptCard.tsx             ← 수정 (CTA에 실제 navigate 연결)
│
└── shared/components/
    └── DevTabBar.tsx                          ← 수정 (집기록 탭 active 상태 연결)

packages/shared/src/
├── utils/
│   └── photoHash.ts                           ← 생성 (SHA-256 해시 생성)
├── constants/
│   └── roomMeta.ts                            ← 생성 (방별 메타데이터 — 이름, 힌트, 팁, 이모지)
└── types/
    └── database.ts                            ← 수정 (PropertyPhoto 타입 보강)
```

---

## 2. 패키지 설치

```bash
# apps/web
pnpm add exifreader    # EXIF 메타데이터 추출 (웹 환경)
```

> **왜 exifreader인가?**: 번들 사이즈가 작고(~25KB gzipped), TypeScript 지원이 좋고,
> 브라우저 File/ArrayBuffer에서 바로 EXIF 파싱 가능. `exif-js`는 유지보수가 중단됨.
> 9단계에서 Expo 네이티브 카메라로 전환하면 네이티브 EXIF API를 쓰게 되고,
> exifreader는 웹 전용 fallback으로 남김.

---

## 3. 방별 메타데이터 상수 (packages/shared)

```typescript
// packages/shared/src/constants/roomMeta.ts

/**
 * DB room 컬럼의 CHECK 제약과 1:1 매칭되는 방 메타데이터
 *
 * 순서: 촬영 가이드 권장 순서 (현관→방→화장실→주방→베란다→기타)
 * 이 순서가 UI 카드 배치 순서이기도 하지만, 강제 아님 (자유형)
 */
export type RoomType = 'entrance' | 'room' | 'bathroom' | 'kitchen' | 'balcony' | 'other'

export interface RoomMeta {
  type: RoomType
  emoji: string // UI에서는 미사용 (제거 예정), 데이터만 보존
  label: string
  hint: string // 카드에 표시되는 한 줄 힌트
  tip: string // 방 상세 진입 시 RoomTipCard에 표시되는 촬영 팁
  tipDetail: string // EmptyState에 표시되는 보조 안내
  recommendedCount: number // 권장 촬영 장수 (진행률 표시용)
  maxCount: number // 방별 업로드 하드 제한 (현관 4, 방 6, 화장실 4, 주방 4, 베란다 3, 기타 3)
}

export const ROOM_META: RoomMeta[] = [
  {
    type: 'entrance',
    emoji: '🚪',
    label: '현관',
    hint: '도어락, 신발장, 바닥',
    tip: '도어락 작동 상태와 현관문 주변 스크래치를 찍어두세요',
    tipDetail: '현관문, 도어락, 신발장, 바닥 타일 상태를 기록하면 좋아요',
  },
  {
    type: 'room',
    emoji: '🛏️',
    label: '방',
    hint: '벽, 바닥, 천장, 창문',
    tip: '벽지 손상, 바닥 긁힘, 창문 잠금장치를 확인하며 찍어두세요',
    tipDetail: '벽지 찢어짐, 바닥 긁힘, 천장 얼룩, 창문 상태를 기록하면 좋아요',
  },
  {
    type: 'bathroom',
    emoji: '🚿',
    label: '화장실',
    hint: '타일, 변기, 세면대, 거울',
    tip: '곰팡이, 타일 깨짐, 배수구 상태를 꼼꼼히 찍어두세요',
    tipDetail: '타일 균열, 곰팡이, 변기·세면대 상태, 환풍기를 기록하면 좋아요',
  },
  {
    type: 'kitchen',
    emoji: '🍳',
    label: '주방',
    hint: '싱크대, 가스레인지, 환풍기',
    tip: '싱크대 물때, 가스레인지 상태, 수납장 내부를 찍어두세요',
    tipDetail: '싱크대, 가스레인지, 수납장, 타일 벽면 상태를 기록하면 좋아요',
  },
  {
    type: 'balcony',
    emoji: '🌿',
    label: '베란다',
    hint: '바닥, 배수구, 창틀',
    tip: '바닥 균열, 배수구 막힘, 창틀 곰팡이를 확인하며 찍어두세요',
    tipDetail: '바닥 상태, 배수구, 창틀, 세탁기 연결부를 기록하면 좋아요',
  },
  {
    type: 'other',
    emoji: '📦',
    label: '기타',
    hint: '복도, 수납, 보일러, 계량기',
    tip: '위 방에 해당하지 않는 곳을 자유롭게 기록하세요',
    tipDetail: '복도, 다용도실, 보일러실, 계량기 등을 기록할 수 있어요',
  },
]

/**
 * RoomType으로 메타 조회 헬퍼
 */
export function getRoomMeta(type: RoomType): RoomMeta {
  return ROOM_META.find((r) => r.type === type)!
}
```

---

## 4. 핵심 유틸리티 (packages/shared)

### 4-1. SHA-256 해시 생성

```typescript
// packages/shared/src/utils/photoHash.ts

/**
 * 파일의 SHA-256 해시를 생성
 *
 * 왜 해시가 필요한가?
 * - 사진이 촬영 후 수정되지 않았음을 증명 (무결성)
 * - 같은 사진이 중복 업로드되는 것을 감지
 * - 보증금 분쟁 시 "이 사진은 원본 그대로"라는 증거
 *
 * Web Crypto API를 사용하므로 추가 라이브러리 불필요.
 * 브라우저 호환성: Chrome 37+, Safari 11+, Firefox 34+
 */
export async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
```

### 4-2. EXIF 추출 (apps/web — exifreader 의존이므로 shared가 아닌 web에서)

```typescript
// apps/web/src/features/photos/utils/exif.ts

import ExifReader from 'exifreader'

/**
 * 사진에서 EXIF 촬영 일시를 추출
 *
 * 추출 항목:
 * - DateTimeOriginal: 촬영 일시 (카메라가 기록한 시점)
 *
 * GPS는 이번 단계에서 제외:
 * - DB에 latitude/longitude 컬럼 없음 (추가는 오버엔지니어링)
 * - 증거력에서 촬영 일시(taken_at)가 GPS보다 훨씬 중요
 * - 필요하면 v1.1에서 컬럼 추가 + 여기에 GPS 추출 로직 복원
 *
 * 왜 촬영 일시가 중요한가?
 * - taken_at 필드에 저장 → 서버 업로드 시각(uploaded_at)과 별개
 * - 오프라인에서 찍고 나중에 업로드해도 실제 촬영 시점 보존
 * - 증거력: "이 사진은 이사 당일에 찍었다"
 *
 * 웹에서의 한계:
 * - 갤러리에서 선택한 사진은 EXIF가 있을 수 있음
 * - 카메라로 직접 촬영한 사진도 대부분 EXIF 포함
 * - 일부 브라우저(iOS Safari)는 <input capture>에서 EXIF를 strip할 수 있음
 * - EXIF 없으면 taken_at = null → uploaded_at을 대신 사용
 */
export async function extractExifTakenAt(file: File): Promise<Date | null> {
  try {
    const tags = await ExifReader.load(file)

    const dateTag = tags['DateTimeOriginal']
    if (dateTag?.description) {
      // EXIF 날짜 형식: "2026:04:14 15:30:00" → ISO 파싱
      const isoString = dateTag.description.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
      const parsed = new Date(isoString)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }

    return null
  } catch {
    // EXIF 파싱 실패 → null 반환 (에러를 삼키지 않되, 사진 업로드는 계속 진행)
    console.warn('[extractExifTakenAt] EXIF 추출 실패, taken_at=null')
    return null
  }
}
```

---

## 5. 서비스 함수 (apps/web/src/services/photos.ts)

```typescript
// apps/web/src/services/photos.ts

import { supabase } from '@/lib/supabase'
import type { PropertyPhoto } from '@shared/types/database'

/**
 * 이사 건의 사진 목록 조회
 * @param moveId - 이사 ID
 * @param photoType - 'move_in' | 'move_out'
 * @returns 사진 목록 (soft delete 제외, 방별 정렬)
 */
export async function getPhotosByMove(
  moveId: string,
  photoType: 'move_in' | 'move_out',
): Promise<PropertyPhoto[]> {
  const { data, error } = await supabase
    .from('property_photos')
    .select('*')
    .eq('move_id', moveId)
    .eq('photo_type', photoType)
    .is('deleted_at', null)
    .order('room')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`[getPhotosByMove] ${error.message}`)
  return data ?? []
}

/**
 * Storage signed URL 생성
 *
 * 왜 signed URL인가?
 * - property-photos 버킷은 private (1단계에서 설정)
 * - DB에는 storage_path만 저장 (전체 URL은 만료되므로 저장 불가)
 * - 필요할 때 1시간짜리 signed URL을 생성해서 사용
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('property-photos')
    .createSignedUrl(storagePath, 3600) // 1시간

  if (error) throw new Error(`[getSignedUrl] ${error.message}`)
  return data.signedUrl
}

/**
 * 사진 업로드 (2단계 프로세스)
 *
 * 1단계: Storage에 파일 업로드
 * 2단계: DB에 메타데이터 저장
 *
 * 왜 2단계인가?
 * - Storage 업로드 실패 시 DB에 고아 레코드가 남지 않음
 * - DB 저장 실패 시 Storage 파일만 남는데, 이건 주기적 정리로 처리 가능
 * - 트랜잭션으로 묶을 수 없음 (Storage ≠ PostgreSQL)
 *
 * Storage 경로 규칙: {move_id}/{photo_type}/{room}_{timestamp}.{ext}
 * - move_id별 폴더 (이사 건 구분)
 * - photo_type별 하위 폴더 (입주/퇴실 구분)
 * - room + timestamp로 유니크 파일명
 *
 * 왜 userId가 아니라 moveId 기반인가?
 * - 현재 8단계 전이라 Supabase Auth 미도입 (guest_id 기반)
 * - userId를 경로에 쓰면 8단계 인증 도입 시 경로 마이그레이션 필요
 * - moveId는 이미 유니크하고, RLS 활성화(8단계) 시 move_id → user_id 검증 가능
 */
export interface UploadPhotoParams {
  moveId: string
  userId: string // DB insert용 (RLS 비정규화). Storage 경로에는 미사용
  file: File
  room: string
  photoType: 'move_in' | 'move_out'
  memo?: string
  imageHash: string
  takenAt?: Date | null
}

export async function uploadPhoto(params: UploadPhotoParams): Promise<PropertyPhoto> {
  const { moveId, userId, file, room, photoType, memo, imageHash, takenAt } = params

  // 1단계: Storage 업로드
  const ext = file.name.split('.').pop() || 'jpg'
  const timestamp = Date.now()
  const storagePath = `${moveId}/${photoType}/${room}_${timestamp}.${ext}`

  const { error: storageError } = await supabase.storage
    .from('property-photos')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (storageError) throw new Error(`[uploadPhoto:storage] ${storageError.message}`)

  // 2단계: DB 메타데이터 저장
  const { data, error: dbError } = await supabase
    .from('property_photos')
    .insert({
      move_id: moveId,
      user_id: userId, // RLS 비정규화 컬럼 (기존 guest_id)
      photo_type: photoType,
      room,
      storage_path: storagePath,
      image_hash: imageHash,
      memo: memo || null,
      taken_at: takenAt?.toISOString() || null,
    })
    .select()
    .single()

  if (dbError) {
    // DB 실패 시 Storage 파일 정리 시도 (best effort)
    await supabase.storage.from('property-photos').remove([storagePath])
    throw new Error(`[uploadPhoto:db] ${dbError.message}`)
  }

  return data
}

/**
 * 사진 soft delete
 *
 * 왜 soft delete인가?
 * - 보증금 분쟁 증거 사진을 실수로 삭제하면 복구 불가
 * - deleted_at 설정 → UI에서 숨김 → 복구 가능
 * - Storage 파일은 삭제하지 않음 (복구 시 필요)
 */
export async function softDeletePhoto(photoId: string): Promise<void> {
  const { error } = await supabase
    .from('property_photos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', photoId)

  if (error) throw new Error(`[softDeletePhoto] ${error.message}`)
}

/**
 * 사진 메모 업데이트
 */
export async function updatePhotoMemo(photoId: string, memo: string): Promise<void> {
  const { error } = await supabase
    .from('property_photos')
    .update({ memo, updated_at: new Date().toISOString() })
    .eq('id', photoId)

  if (error) throw new Error(`[updatePhotoMemo] ${error.message}`)
}
```

---

## 6. TanStack Query 훅

### 6-1. 쿼리 키

```typescript
// apps/web/src/features/photos/hooks/queryKeys.ts

export const photoKeys = {
  all: ['photos'] as const,
  byMove: (moveId: string, photoType: string) => [...photoKeys.all, moveId, photoType] as const,
}
```

### 6-2. usePhotos

```typescript
// apps/web/src/features/photos/hooks/usePhotos.ts

import { useQuery } from '@tanstack/react-query'
import { getPhotosByMove } from '@/services/photos'
import { photoKeys } from './queryKeys'

/**
 * 이사 건의 사진 목록 조회
 * photoType 변경 시 자동으로 refetch (입주/퇴실 토글)
 */
export function usePhotos(moveId: string | undefined, photoType: 'move_in' | 'move_out') {
  return useQuery({
    queryKey: photoKeys.byMove(moveId ?? '', photoType),
    queryFn: () => getPhotosByMove(moveId!, photoType),
    enabled: !!moveId,
  })
}
```

### 6-3. useUploadPhoto

```typescript
// apps/web/src/features/photos/hooks/useUploadPhoto.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadPhoto, type UploadPhotoParams } from '@/services/photos'
import { generateFileHash } from '@shared/utils/photoHash'
import { extractExifTakenAt } from '../utils/exif'
import { photoKeys } from './queryKeys'
import { useToast } from '@/shared/components/Toast'

/**
 * 사진 업로드 뮤테이션
 *
 * 업로드 파이프라인:
 * 1. EXIF 추출 (촬영 일시)
 * 2. SHA-256 해시 생성 (무결성 증거)
 * 3. Storage 업로드 + DB 저장 (서비스 함수)
 * 4. 성공 시 사진 목록 캐시 무효화
 *
 * 여러 장 업로드: 호출하는 쪽에서 Promise.allSettled로 병렬 처리
 * 개별 실패는 토스트로 알림, 성공한 사진은 정상 저장
 */
export function useUploadPhoto(moveId: string, photoType: 'move_in' | 'move_out') {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: async (
      params: Omit<UploadPhotoParams, 'imageHash' | 'takenAt'> & { file: File },
    ) => {
      const [takenAt, imageHash] = await Promise.all([
        extractExifTakenAt(params.file),
        generateFileHash(params.file),
      ])

      return uploadPhoto({
        ...params,
        imageHash,
        takenAt,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: photoKeys.byMove(moveId, photoType) })
    },
    onError: (error) => {
      toast.error('사진 저장에 실패했어요. 다시 시도해주세요.')
      console.error('[useUploadPhoto]', error)
    },
  })
}
```

### 6-4. useDeletePhoto

```typescript
// apps/web/src/features/photos/hooks/useDeletePhoto.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { softDeletePhoto } from '@/services/photos'
import { photoKeys } from './queryKeys'
import { useToast } from '@/shared/components/Toast'

/**
 * 사진 soft delete 뮤테이션
 * 낙관적 업데이트: UI에서 즉시 제거 → 실패 시 롤백
 */
export function useDeletePhoto(moveId: string, photoType: 'move_in' | 'move_out') {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: softDeletePhoto,
    onMutate: async (photoId) => {
      await queryClient.cancelQueries({ queryKey: photoKeys.byMove(moveId, photoType) })
      const previous = queryClient.getQueryData(photoKeys.byMove(moveId, photoType))

      queryClient.setQueryData(
        photoKeys.byMove(moveId, photoType),
        (old: any[]) => old?.filter((p) => p.id !== photoId) ?? [],
      )

      return { previous }
    },
    onError: (_err, _photoId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(photoKeys.byMove(moveId, photoType), context.previous)
      }
      toast.error('삭제에 실패했어요. 다시 시도해주세요.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: photoKeys.byMove(moveId, photoType) })
    },
  })
}
```

### 6-5. useSignedUrls (배치)

```typescript
// apps/web/src/features/photos/hooks/useSignedUrls.ts

import { useQuery } from '@tanstack/react-query'
import { getSignedUrls } from '@/services/photos'

/**
 * 사진 목록의 signed URL 일괄 조회
 *
 * 왜 단일(useSignedUrl)이 아니라 배치인가?
 * - 사진 20장을 한번에 보려면 API 20번 호출 vs 배치 1번 호출
 * - Supabase JS v2의 createSignedUrls(복수형)로 한번에 처리
 * - PhotoDetailSheet에서는 이미 조회된 URL을 props로 전달 (추가 호출 불필요)
 *
 * staleTime 30분: signed URL 유효기간(1시간)의 절반
 * 캐시 키: storagePaths를 정렬해서 동일 세트는 캐시 히트
 */
export function useSignedUrls(storagePaths: string[]) {
  return useQuery({
    queryKey: ['signedUrls', ...storagePaths.sort()],
    queryFn: () => getSignedUrls(storagePaths),
    enabled: storagePaths.length > 0,
    staleTime: 30 * 60 * 1000, // 30분
  })
}
```

### 6-6. useUpdatePhotoMemo

```typescript
// apps/web/src/features/photos/hooks/useUpdatePhotoMemo.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updatePhotoMemo } from '@/services/photos'
import { photoKeys } from './queryKeys'
import { useToast } from '@/shared/components/Toast'

/**
 * 사진 메모 업데이트 뮤테이션
 *
 * 4단계 MemoSection 패턴 재사용:
 * - 디바운스 1초 (호출하는 쪽에서 처리)
 * - in-flight 직렬화 (최신 값만 서버 반영)
 * - 성공 토스트 없음 (자동저장이므로), 실패만 토스트
 */
export function useUpdatePhotoMemo(moveId: string, photoType: 'move_in' | 'move_out') {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ photoId, memo }: { photoId: string; memo: string }) =>
      updatePhotoMemo(photoId, memo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: photoKeys.byMove(moveId, photoType) })
    },
    onError: () => {
      toast.error('메모 저장에 실패했어요')
    },
  })
}
```

---

## 7. 페이지 / 라우트

### 7-1. 라우트 등록

```typescript
// App.tsx에 추가

import PhotosPage from '@/pages/PhotosPage'
import PhotoRoomPage from '@/pages/PhotoRoomPage'
import PhotoReportPage from '@/pages/PhotoReportPage'
import PhotoTrashPage from '@/pages/PhotoTrashPage'

// <Routes> 안에 추가
<Route path="/photos" element={<PhotosPage />} />
<Route path="/photos/report" element={<PhotoReportPage />} />
<Route path="/photos/trash" element={<PhotoTrashPage />} />
<Route path="/photos/:room" element={<PhotoRoomPage />} />
```

> 라우트 순서 주의: `/photos/report`가 `/photos/:room`보다 먼저 와야
> "report"가 room 파라미터로 매칭되지 않음.

### 7-2. PhotosPage (집기록 탭 메인)

```
┌──────────────────────────────┐
│ ← 집 상태 기록               │  ← PageHeader
│                              │
│ ┌──────────┬──────────┐      │
│ │  퇴실    │  ● 입주  │      │  ← PhotoTypeToggle (세그먼트 컨트롤)
│ └──────────┴──────────┘      │
│                              │
│   입주 사진을 찍어두면        │  ← 상단 안내 문구
│   나중에 보증금을 지켜줘요    │
│                              │
│ ┌─────────────┬─────────────┐│
│ │ 🚪 현관  3장│ 🛏️ 방   5장 ││  ← RoomGrid (2열)
│ │ 도어락,바닥 │ 벽,바닥,천장││     힌트 텍스트
│ ├─────────────┼─────────────┤│
│ │ 🚿 화장실 2장│ 🍳 주방 0장││
│ │ 타일,변기   │ 싱크대,가스 ││
│ ├─────────────┼─────────────┤│
│ │ 🌿 베란다 0장│ 📦 기타 1장││
│ │ 바닥,배수구 │ 복도,보일러 ││
│ └─────────────┴─────────────┘│
│                              │
│ ┌──────────────────────────┐ │
│ │  📋  리포트 보기  →      │ │  ← 사진 1장+ 있을 때만 노출
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │  🏠      📋      📷     │ │
│ │  홈     전체    집기록    │ │  ← DevTabBar (집기록 active)
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**동작:**

- 입주/퇴실 토글 상태 관리:
  1. URL 쿼리 파라미터 `?type=move_in` 이 있으면 그대로 사용 (유저 선택 유지)
  2. 쿼리 파라미터 없으면 D-Day 기준 자동 선택 (이사일 이전 = 퇴실, 이사일 이후 = 입주)
  3. 토글 전환 시 `navigate('/photos?type=move_out', { replace: true })` → URL 반영
- 방 카드 클릭 → `/photos/:room?type=move_in` (현재 선택된 photoType을 쿼리 파라미터로 전달)
- "리포트 보기" → `/photos/report?type=move_in`
- 사진 0장일 때 리포트 버튼 숨김
- 방별 사진 상세에서 뒤로가기 시 토글 상태 유지 (쿼리 파라미터 덕분)

**안내 문구:**

- 입주: "입주 사진을 찍어두면 나중에 보증금을 지켜줘요"
- 퇴실: "퇴실 전 집 상태를 기록해두세요"

### 7-3. PhotoRoomPage (방별 사진 상세)

```
┌──────────────────────────────┐
│ ←                       🕓   │  ← 뒤로가기 + 최근삭제(History) 아이콘
│                              │
│ 현관                         │  ← iOS 대형 타이틀 (28px bold)
│ 2장 / 최대 4장               │  ← 서브텍스트 (방 가득 차면 "· 가득 참" 추가)
│                              │
│ ┌──────────────────────────┐ │
│ │ 💡 도어락 작동 상태와 현  │ │  ← RoomTipCard (토스 스타일: Lightbulb 아이콘 + 연한 bg)
│ │    관문 주변 스크래치를   │ │     사진 3장+ 이면 자동 숨김
│ │    찍어두세요             │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │                     ⋯    │ │  ← PhotoCard: 4:3 비율, 타임스탬프 오버레이
│ │                          │ │     좌하단: 날짜(14px) + 시간(26px extrabold)
│ │  2026년 4월 21일         │ │     우상단: ⋯ 더보기 메뉴 (bg-black/40 원형)
│ │  오후 1:56               │ │     → "메모 편집" / "삭제" 드롭다운
│ └──────────────────────────┘ │
│  메모 추가                   │  ← 탭하면 인라인 textarea (debounce 1초, 200자)
│                              │
│ (사진 카드 반복)             │
│                              │
│                         [+]  │  ← PhotoUploadFab (우하단 FAB)
│                              │     탭: 갤러리/촬영 옵션 표시, +가 45° 회전
└──────────────────────────────┘
```

**사진이 없을 때:**

```
┌──────────────────────────────┐
│ ←                       🕓   │
│                              │
│ 현관                         │
│                              │
│          📷                  │
│                              │
│    아직 사진이 없어요        │  ← PhotoEmptyState
│                              │
│    현관문, 도어락, 신발장,   │
│    바닥 타일 상태를          │
│    기록하면 좋아요           │  ← tipDetail 텍스트
│                              │
│  [📷 촬영] [🖼️ 갤러리]     │  ← EmptyState 내 CTA 버튼
│                              │
└──────────────────────────────┘
```

**동작:**

- "촬영" 버튼: `<input type="file" accept="image/*" capture="environment">` → 카메라 열림 → 한 장 촬영
- "갤러리" 버튼: `<input type="file" accept="image/*" multiple>` → 갤러리 열림 → 여러 장 선택
- 방별 maxCount 제한: 업로드 시 남은 슬롯만큼만 허용, 초과 시 토스트 안내
- 사진 선택/촬영 후 → 즉시 업로드 파이프라인 실행 (EXIF 추출 → 해시 → Storage → DB)
- 업로드 중 각 사진에 스피너 표시
- 사진 탭 → PhotoFullscreenViewer (createPortal, 핀치줌 1~4x, 더블탭 토글)
- ⋯ 메뉴 → "메모 편집" (인라인 textarea) / "삭제" (DeletePhotoDialog)
- RoomTipCard: 사진이 0~2장일 때 표시, 3장 이상이면 자동 숨김
- PhotoUploadFab: 사진 1장+ 있을 때만 표시 (비어있으면 EmptyState CTA 사용)

### 7-4. PhotoFullscreenViewer (사진 풀스크린 뷰어)

```
┌──────────────────────────────┐
│      4월 21일 월요일    ×    │  ← 날짜 가운데, X 오른쪽 (z-10)
│                              │
│                              │
│ ┌──────────────────────────┐ │
│ │                          │ │
│ │      (사진 풀 사이즈)     │ │  ← max-h-[70dvh], 핀치줌 1~4x
│ │                          │ │     더블탭: 1x ↔ 2x 토글
│ └──────────────────────────┘ │
│  메모가 있으면 여기에 표시    │  ← mt-4, 사진 바로 아래
│                              │
└──────────────────────────────┘
```

**동작:**

- createPortal(document.body)로 렌더 → z-index 스태킹 이슈 방지
- 핀치줌: React.TouchList로 scale/translate, 1~4x 범위
- 더블탭: 1x와 2x 사이 토글
- X 버튼: relative z-10으로 사진 영역 위에 유지 (터치 이벤트 차단 방지)
- 메모: 사진 바로 아래 표시 (읽기 전용)

### 7-4b. 삭제/메모 — 인라인 처리

사진 상세 바텀시트(PhotoDetailSheet)는 제거됨. 대신:

- **메모 편집**: PhotoGrid 내 PhotoCard에서 인라인 처리. "메모 추가" 탭 → textarea 표시, debounce 1초 자동저장 (200자 제한)
- **삭제**: ⋯ 메뉴 → "삭제" → DeletePhotoDialog (바텀시트 스타일)

### 7-5. PhotoReportPage (리포트)

```
┌──────────────────────────────┐
│ ← 입주 기록 리포트           │  ← PageHeader
│                              │
│ ┌──────────────────────────┐ │
│ │ 📸  입주 기록             │ │  ← ReportHeader
│ │ 2026년 4월 14일           │ │     가장 이른 사진의 taken_at
│ │ 총 11장 · 메모 3건        │ │
│ └──────────────────────────┘ │
│                              │
│ ══════════════════════════   │
│                              │
│ 🚪 현관 (3장)               │  ← ReportRoomSection
│                              │
│ ┌──────┬──────┬──────┐       │
│ │      │      │      │       │
│ │ 사진1│ 사진2│ 사진3│       │
│ └──────┴──────┴──────┘       │
│ "도어락 작동 확인됨"         │  ← 메모 있는 사진만 메모 표시
│                              │
│ ══════════════════════════   │
│                              │
│ 🛏️ 방 (5장)                 │
│                              │
│ ┌──────┬──────┬──────┐       │
│ │ 사진1│ 사진2│ 사진3│       │
│ ├──────┼──────┤       │       │
│ │ 사진4│ 사진5│       │       │
│ └──────┴──────┘       │       │
│                              │
│ ══════════════════════════   │
│                              │
│ (방별 반복)                  │
│                              │
│ ┌──────────────────────────┐ │
│ │ 💡 이 기록은 퇴실 시     │ │  ← TipCard (하단)
│ │    보증금 분쟁 증거로     │ │
│ │    활용할 수 있어요       │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │  🏠      📋      📷     │ │
│ │  홈     전체    집기록    │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**동작:**

- 읽기 전용 페이지 — 편집 불가, 사진 탭하면 PhotoFullscreenViewer 오픈
- 방 순서: ROOM_META 순서 (현관→방→화장실→주방→베란다→기타)
- 사진이 0장인 방은 표시 안 함
- "리포트 보기" 진입 시 현재 선택된 photoType(입주/퇴실) 기준
- 하단 TipCard: "이 기록은 보증금 분쟁 시 증거로 활용할 수 있어요" + SHA-256 안내
- 하단 공유 CTA: Web Share API (navigator.share) + clipboard 폴백

**리포트 날짜 기준:**

- 각 사진의 대표 일시 = `taken_at ?? uploaded_at` (EXIF 있으면 촬영 일시, 없으면 업로드 일시)
- 리포트 헤더 날짜 = 모든 사진의 대표 일시 중 가장 이른 날짜
- 개별 사진 날짜도 같은 규칙 적용

**구현 반영 (스펙 대비 변경):**

- 와이어프레임의 DevTabBar → 제거 (리포트는 몰입형 상세 페이지, iOS 패턴)
- TipCard 아이콘: 💡 Lightbulb → ShieldCheck (증거 보호 의미)
- ReportRoomSection: progress bar 제거 → "N장" 카운트, 사진 위 에디토리얼 번호 배지 (font-extrabold + drop-shadow), 메모는 "메모" 라벨 + "번호. 텍스트" 미니멀 포맷 (line-clamp-2)
- ReportHeader: 타입 배지(입주/퇴실 기록) + 날짜 제목 + 통계 (사진·메모·공간)
- 공유 CTA: sticky 하단 바 + gradient fade
- Footer: 생성 일시 + 앱 이름

### 7-6. PhotoTrashPage (최근 삭제)

```
┌──────────────────────────────┐
│ ←                            │  ← 뒤로가기
│                              │
│ 최근 삭제                    │  ← iOS 대형 타이틀 (28px bold)
│ 방마다 최대 3장까지 저장돼요  │  ← 서브텍스트 2줄
│ 사진은 30일 뒤 자동으로       │
│ 정리돼요                     │
│                              │
│ [전체 5] [현관 2] [방 3]     │  ← 필터 칩 (가로 스크롤)
│                              │     활성: bg-primary + white text
│                              │     비활성: bg-black/5% + muted text
│ ┌────────┐                   │
│ │ 72×72  │ 현관 · 바닥 스크래치  ← 방이름 · 메모 (15.5px semibold, truncate)
│ │ 사진   │ 3분 전 삭제됨 · 27일 뒤 정리  ← 시간 + 남은 일수
│ │        │            복구  삭제│  ← 오른쪽: 복구(primary) 삭제(muted)
│ └─��──────┘─ ─ ─ ─ ─ ─ ─ ─ ─ ─│  ← 구분선 (left: 100px부터)
│                              │
│ (리스트 반복)                │
└──────────────────────────────┘
```

**라우트:** `/photos/trash?type=move_in`

**동작:**

- 필터 칩: 방 2개+ 있을 때만 표시, 전체 + 삭제된 사진이 있는 방만
- 리스트 아이템: 72px 썸네일 + "방이름 · 메모" (메모 없으면 방이름만) + 시간 + 남은 일수
- 남�� 일수 3일 이하: primary 색상 강조 (긴급)
- "복구": 방이 가득 찼으면 disabled + 토스트 안내 ("방 사진이 가득 찼어요")
- "삭제": 영구삭제 (hardDeletePhoto — Storage 파일도 제거)
- 구분선: 썸네일 뒤(left 100px)부터 시작 (iOS 네��티브 패턴)
- 빈 상태: Trash2 아이콘 + "삭제된 사진이 없어요"
- timeAgo: differenceInMinutes 기반 자체 구현 (분/시간/일/주/개월)
- daysLeft: 삭제일로부터 30일 카운트다운

**서비스 함수 (추가):**

- `getAllDeletedPhotos(moveId, photoType)` — 전체 방의 삭제된 사진 조회
- `getDeletedPhotos(moveId, photoType, room)` — 방별 삭제된 사진 조회
- `restorePhoto(photoId)` — deleted_at을 null로 복구
- `hardDeletePhoto(photoId, storagePath)` — DB 삭제 + Storage 파일 삭제

**훅 (추가):**

- `useDeletedPhotos(moveId, photoType, room)` — 방별 삭제 사진 조회
- `useRestorePhoto` — 복구 뮤테이션
- `photoKeys.deleted(moveId, photoType, room)` — 방별 삭제 쿼리 키
- `photoKeys.allDeleted(moveId, photoType)` — 전체 삭제 쿼리 키

---

## 8. 컴포넌트 상세

### 8-1. PhotoTypeToggle

```typescript
interface PhotoTypeToggleProps {
  value: 'move_in' | 'move_out'
  onChange: (type: 'move_in' | 'move_out') => void
}
```

| 속성   | 값                                                       |
| ------ | -------------------------------------------------------- |
| 형태   | 세그먼트 컨트롤 (2개 버튼)                               |
| 너비   | 좌우 패딩 20px, 내부 동일 비율                           |
| 높이   | 40px                                                     |
| 배경   | bg-background-secondary (비선택)                         |
| 선택   | bg-white + shadow-sm + 둥글기 (선택)                     |
| 텍스트 | 비선택 = tertiary, 선택 = secondary + font-semibold      |
| 전환   | transition-all 200ms                                     |
| 접근성 | `role="tablist"`, 각 버튼 `role="tab"` + `aria-selected` |

기본 선택 로직:

```typescript
const defaultPhotoType = daysUntilMove > 0 ? 'move_out' : 'move_in'
// D-Day 이전(이사 안 함): 구 집 퇴실 기록이 우선
// D-Day 이후(이사 완료): 새 집 입주 기록이 우선
```

### 8-2. RoomCard

```typescript
interface RoomCardProps {
  room: RoomMeta
  photoCount: number
  thumbnailUrl?: string // 첫 번째 사진의 signed URL
  onPress: () => void
}
```

| 속성      | 값                                              |
| --------- | ----------------------------------------------- |
| 레이아웃  | 2열 그리드 카드                                 |
| 높이      | 고정 100px                                      |
| 배경      | bg-white, 사진 있으면 썸네일 배경 (opacity 20%) |
| 둥글기    | rounded-xl (16px)                               |
| 보더      | border border-border                            |
| 좌상단    | 이모지 + 방 이름 (font-semibold)                |
| 우상단    | 사진 수 "3장" (tertiary)                        |
| 하단      | 힌트 텍스트 (caption, tertiary)                 |
| 사진 0장  | 힌트 텍스트 + muted 톤, 이모지 크게             |
| 사진 1+장 | 배경에 첫 사진 썸네일 깔기 (blur + overlay)     |
| 접근성    | `role="button"`, `aria-label="현관 사진 3장"`   |

### 8-3. PhotoGrid

```typescript
interface PhotoGridProps {
  photos: PropertyPhoto[]
  onPhotoPress: (photo: PropertyPhoto) => void
  isUploading?: boolean // 업로드 중 스피너 표시용
}
```

| 속성      | 값                                             |
| --------- | ---------------------------------------------- |
| 레이아웃  | 3열 그리드, gap 4px                            |
| 셀 비율   | 1:1 정사각형 (aspect-square)                   |
| 셀 둥글기 | rounded-lg (12px)                              |
| 이미지    | object-cover, 꽉 참                            |
| 메모 표시 | 좌하단에 작은 말풍선 아이콘 (메모 있는 사진만) |
| 업로드 중 | 반투명 오버레이 + 스피너                       |

### 8-4. PhotoUploadButton

```typescript
interface PhotoUploadButtonProps {
  onCapture: (file: File) => void
  onGallerySelect: (files: File[]) => void
  disabled?: boolean
}
```

| 속성     | 값                                                        |
| -------- | --------------------------------------------------------- |
| 위치     | 하단 고정 (sticky bottom), 좌우 패딩 20px, 하단 safe-area |
| 레이아웃 | 2개 버튼 가로 나란히, gap 12px                            |
| "촬영"   | Camera 아이콘 + "촬영", variant=primary                   |
| "갤러리" | Image 아이콘 + "갤러리", variant=secondary                |
| 높이     | 48px                                                      |
| 둥글기   | rounded-xl                                                |

내부 구현:

```typescript
// 카메라 촬영 (한 장)
<input
  type="file"
  accept="image/*"
  capture="environment"  // 후면 카메라
  onChange={(e) => {
    const file = e.target.files?.[0]
    if (file) onCapture(file)
  }}
  ref={cameraInputRef}
  hidden
/>

// 갤러리 선택 (여러 장)
<input
  type="file"
  accept="image/*"
  multiple
  onChange={(e) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onGallerySelect(files)
  }}
  ref={galleryInputRef}
  hidden
/>
```

### 8-5. PhotoDetailSheet

```typescript
interface PhotoDetailSheetProps {
  photo: PropertyPhoto
  signedUrl: string
  isOpen: boolean
  onClose: () => void
  onDelete: (photoId: string) => void
  onMemoUpdate: (photoId: string, memo: string) => void
}
```

| 속성      | 값                                                             |
| --------- | -------------------------------------------------------------- |
| 형태      | fixed 오버레이 (z-50), 배경 반투명 black/50                    |
| 패널      | bg-white, 하단에서 올라오는 형태, rounded-t-2xl                |
| 사진      | max-height 50vh, object-contain                                |
| 날짜      | 14px, tertiary, taken_at 또는 uploaded_at                      |
| 메모      | textarea, 디바운스 1초 자동저장, placeholder "메모 입력..."    |
| 삭제      | text-system-critical, 클릭 시 DeletePhotoDialog 오픈           |
| 닫기      | 우상단 X 아이콘, 또는 배경 클릭                                |
| 접근성    | `role="dialog"`, `aria-modal="true"`, `aria-label="사진 상세"` |
| ESC       | 키보드 ESC로 닫기                                              |
| 메모 저장 | useUpdatePhotoMemo 훅 사용 (디바운스 1초, 4단계 패턴 재사용)   |

### 8-6. DeletePhotoDialog (바텀시트 스타일)

```typescript
interface DeletePhotoDialogProps {
  isOpen: boolean
  overflow?: boolean // 최근 삭제가 방별 3장 제한에 도달했는지
  onClose: () => void
  onConfirm: () => void
}
```

```
┌──────────────────────────────┐  ← 하단에서 올라오는 바텀시트 (slideUp 200ms)
│                              │
│   이 사진을 삭제할까요?      │  ← 17px bold
│                              │
│   최근 삭제에서 복구할 수    │  ← 14px muted (기본)
│   있어요.                    │
│                              │  ← overflow=true일 때:
│   또는:                      │     "최근 삭제가 가득 찼어요."
│   최근 삭제가 가득 찼어요.   │     (줄바꿈)
│   가장 오래된 사진 1장이     │     "가장 오래된 사진 1장이 영구삭제돼요."
│   영구삭제돼요.              │
│                              │
│   ┌──────────┬─────────────┐ │
│   │  취소    │    삭제     │ │  ← 52px, 취소=bg-black/4%, 삭제=bg-critical
│   └──────────┴─────────────┘ │
└──────────────────────────────┘
```

- 바텀시트: `flex items-end` + safe-area 패딩, slideUp 애니메이션
- "취소": bg-black/[0.04] (토스 스타일)
- "삭제": bg-critical
- overflow prop: PhotoGrid에서 useDeletedPhotos를 미리 fetch → 캐시 워밍으로 깜빡임 방지
- 배경 클릭으로 닫기 가능
- 접근성: `role="alertdialog"`, `aria-describedby`

---

## 9. 대시보드 연결 (기존 코드 수정)

### 9-1. PhotoPromptCard CTA 연결

```typescript
// apps/web/src/features/dashboard/components/PhotoPromptCard.tsx

// 기존: console.log('TODO: 집기록')
// 변경: navigate('/photos')

import { useNavigate } from 'react-router-dom'

const navigate = useNavigate()

// CTA 버튼 onClick
onClick={() => navigate('/photos')}
```

### 9-2. DevTabBar 집기록 탭 연결

```typescript
// 기존 DevTabBar의 집기록 탭
// path: '/photos'
// active 판별: location.pathname.startsWith('/photos')
```

---

## 10. signed URL 캐싱 전략

사진 목록을 조회할 때 DB에는 `storage_path`만 있고, 화면에 보여주려면 signed URL이 필요합니다.

**문제**: 사진 20장을 한번에 보려면 signed URL 20개를 생성해야 하고, 매번 Supabase API를 호출하면 느림.

**해결**: 배치 signed URL 생성 + TanStack Query 캐싱

```typescript
// apps/web/src/services/photos.ts (추가)

/**
 * 여러 사진의 signed URL을 한번에 생성
 * Supabase JS v2에서는 createSignedUrls (복수형) 지원
 */
export async function getSignedUrls(storagePaths: string[]): Promise<Map<string, string>> {
  if (storagePaths.length === 0) return new Map()

  const { data, error } = await supabase.storage
    .from('property-photos')
    .createSignedUrls(storagePaths, 3600) // 1시간

  if (error) throw new Error(`[getSignedUrls] ${error.message}`)

  const urlMap = new Map<string, string>()
  data?.forEach((item) => {
    if (item.signedUrl) {
      urlMap.set(item.path, item.signedUrl)
    }
  })
  return urlMap
}
```

```typescript
// apps/web/src/features/photos/hooks/useSignedUrls.ts

import { useQuery } from '@tanstack/react-query'
import { getSignedUrls } from '@/services/photos'

/**
 * 사진 목록의 signed URL 일괄 조회
 * storagePaths가 변경될 때만 refetch
 * staleTime 30분 (signed URL 유효 1시간)
 */
export function useSignedUrls(storagePaths: string[]) {
  return useQuery({
    queryKey: ['signedUrls', ...storagePaths.sort()],
    queryFn: () => getSignedUrls(storagePaths),
    enabled: storagePaths.length > 0,
    staleTime: 30 * 60 * 1000,
  })
}
```

---

## 11. 여러 장 업로드 처리

```typescript
// PhotoRoomPage 내부에서 갤러리 여러 장 선택 시:

const uploadMutation = useUploadPhoto(moveId, photoType)

async function handleGallerySelect(files: File[]) {
  // 파일 크기 검증 (10MB 제한)
  const validFiles = files.filter((f) => {
    if (f.size > 10 * 1024 * 1024) {
      toast.error(`${f.name}은 10MB를 초과해서 건너뛰었어요`)
      return false
    }
    return true
  })

  if (validFiles.length === 0) return

  // 업로드 진행률 표시
  setUploadingCount(validFiles.length)

  // 병렬 업로드 (사진 5~10장 수준이라 동시 제한 불필요)
  const results = await Promise.allSettled(
    validFiles.map((file) =>
      uploadMutation.mutateAsync({
        moveId,
        userId,
        file,
        room,
        photoType,
      }),
    ),
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  setUploadingCount(0)

  if (failed > 0) {
    toast.error(`${failed}장 저장에 실패했어요`)
  }
  if (succeeded > 0) {
    toast.success(`${succeeded}장 저장 완료`)
  }
}
```

> **왜 Promise.allSettled인가?**: Promise.all은 하나라도 실패하면 전체 reject.
> 5장 중 1장만 실패해도 전부 실패 처리되면 UX가 나쁨.
> allSettled은 각각 독립적으로 결과를 받아서 성공/실패를 개별 처리 가능.

---

## 12. 접근성 (a11y)

- PhotoTypeToggle: `role="tablist"`, 각 버튼 `role="tab"` + `aria-selected`
- RoomCard: `role="button"`, `aria-label="현관 사진 3장"`
- PhotoGrid 사진: `role="button"`, `aria-label="사진 1, 2026년 4월 14일 촬영"` (메모 있으면 메모 포함)
- PhotoDetailSheet: `role="dialog"`, `aria-modal="true"`, `aria-label="사진 상세"`
- PhotoUploadButton: `aria-label="카메라로 촬영"`, `aria-label="갤러리에서 선택"`
- 삭제 확인: `role="alertdialog"`, `aria-describedby` 설명 연결
- 업로드 중: `aria-busy="true"`, 스크린리더에 "사진 업로드 중" 안내
- input[type="file"]: `aria-label` 설정 (숨겨진 input이지만 스크린리더 접근)

---

## 13. 엣지케이스 / 주의사항

### 이사 데이터 없음

- `/photos` 직접 접근 + active 이사 없음 → 랜딩으로 리다이렉트 (3단계 패턴 동일)

### 사진 0장 상태

- PhotosPage: 모든 방 카드가 0장 → 상단 안내 문구만 표시, 리포트 버튼 숨김
- PhotoRoomPage: PhotoEmptyState 표시 + 업로드 버튼 활성
- PhotoReportPage: "/photos"로 리다이렉트 (볼 사진이 없으므로)

### 대용량 파일

- 10MB 초과 파일 → 업로드 전 프론트에서 차단 + 토스트 안내
- Supabase Storage 기본 제한: Free 50MB/파일, 1GB 총 용량
- 이미지만 허용 (`accept="image/*"`) → 동영상 차단

### EXIF 없는 사진

- EXIF 추출 실패 → taken_at = null → DB에 null 저장
- UI에서 taken_at 없으면 uploaded_at 표시 (대체)
- 리포트 날짜: 모든 사진의 taken_at 또는 uploaded_at 중 가장 이른 날짜

### signed URL 만료

- staleTime 30분으로 TanStack Query 캐시 관리
- 만료된 URL로 이미지 로드 실패 → onError에서 자동 refetch
- `<img>` onError 핸들러: 쿼리 무효화 → 새 signed URL 생성

### Storage 업로드 성공 + DB 저장 실패

- 서비스 함수에서 DB 실패 시 Storage 파일 삭제 시도 (best effort)
- 삭제도 실패하면 orphan 파일이 Storage에 남음
- 운영: 주기적으로 DB에 없는 Storage 파일 정리 스크립트 (v1.1 이후)

### 동일 사진 중복 업로드

- SHA-256 해시로 감지 가능하지만, 6단계에서는 차단하지 않음
- 같은 사진을 다른 방에 올리는 것은 정당한 사용 (예: 복도 겸 현관)
- v1.1에서 "이미 올린 사진이에요" 경고 추가 고려

### 오프라인

- 오프라인 시: 업로드 버튼 disabled + OfflineBanner
- 이미 로드된 signed URL 이미지는 캐시로 표시 가능
- 오프라인 촬영 + 큐잉은 8단계 이후 (IndexedDB + 인증 필요)

### 삭제 복구

- soft delete이므로 DB에 레코드 + Storage에 파일 모두 보존
- PhotoTrashPage에서 복구/영구삭제 가능
- 복구 시 해당 방의 maxCount 확인 → 가득 차면 토스트 안내 후 차단
- 영구삭제: DB 레코드 삭제 + Storage 파일 삭제 (hardDeletePhoto)

### 최근 삭제 방별 제한 (MAX_DELETED_PER_ROOM = 3)

- 방마다 삭제 보관 최대 3장
- 삭제 시 해당 방의 삭제 사진이 3장 이상이면 DeletePhotoDialog에 overflow 경고 표시
- "가장 오래된 사진 1장이 영구삭제돼요" — 실제 구현은 서비스 함수에서 처리
- DeletePhotoDialog flicker 방지: PhotoGrid 레벨에서 useDeletedPhotos 미리 fetch → 캐시 워밍

### 삭제 다이얼로그 깜빡임 (flicker) 방지

- 원인: DeleteCardWrapper 마운트 시 useDeletedPhotos fetch → 0.5초간 isOverflow=false로 표시됨
- 해결: PhotoGrid에서 useDeletedPhotos를 미리 호출 → TanStack Query 캐시에 데이터 보존
- DeleteCardWrapper는 isOverflow를 props로 받음 (직접 fetch 안 함)
- 결과: 다이얼로그가 열릴 때 캐시 hit → 즉시 올바른 버전 표시

### 방별 maxCount 업로드 제한

- 각 방마다 maxCount 하드 제한 (현관 4, 방 6, 화장실 4, 주방 4, 베란다 3, 기타 3)
- 업로드 시 remaining = maxCount - 현재 사진 수, 초과분은 slice로 잘라냄
- 가득 차면: 토스트 안내, PhotoUploadFab disabled
- 최근 삭제���서 복구 시에도 maxCount 체크 → 가득 차면 복구 차단

### 30일 자동 삭제

- 최근 삭제 리스트에서 daysLeft(삭제일로부터 30일 카운트다운) 표시
- 3일 이하: primary 색상으로 긴급 표시
- 실제 자동 삭제 cron: 8단계 이후 (Supabase Edge Function으로 구현 예정)
- 현재는 UI에서만 표시, 실제 삭제는 수동(영구삭제 버튼)

---

## 14. 완료 확인 기준 (체크리스트)

### 빌드

- [ ] `pnpm build` — 성공
- [ ] `pnpm lint` — 에러 0
- [ ] `pnpm test` — 기존 테스트 통과 + photoHash 테스트 추가
- [ ] 추가 패키지: exifreader만 설치됨

### 라우트

- [ ] `/photos` → PhotosPage 렌더링
- [ ] `/photos/report` → PhotoReportPage 렌더링 ("report"가 room 파라미터로 매칭 안 됨)
- [ ] `/photos/trash` → PhotoTrashPage 렌더링
- [ ] `/photos/entrance` → PhotoRoomPage 렌더링 (room=entrance)
- [ ] 이사 없이 `/photos` 직접 접근 → 랜딩 리다이렉트

### 입주/퇴실 토글

- [ ] D-Day 이전: "퇴실" 기본 선택
- [ ] D-Day 이후: "입주" 기본 선택
- [ ] 토글 전환 시 해당 타입의 사진 목록으로 전환
- [ ] 접근성: role="tablist", aria-selected

### 방별 카드

- [ ] 6개 방 카드 표시 (현관, 방, 화장실, 주방, 베란다, 기타)
- [ ] 각 카드에 사진 수 표시
- [ ] 힌트 텍스트 표시
- [ ] 카드 클릭 → `/photos/:room` 이동

### 사진 촬영/선택

- [ ] "촬영" 버튼 → 카메라 열림 → 한 장 촬영 → 업로드
- [ ] "갤러리" 버튼 → 갤러리 열림 → 여러 장 선택 → 업로드
- [ ] 10MB 초과 파일 → 토스트 에러 + 건너뛰기
- [ ] 업로드 중 스피너 표시

### EXIF + 해시

- [ ] EXIF에서 촬영 일시 추출 → taken_at에 저장
- [ ] EXIF 없으면 taken_at = null (에러 아님)
- [ ] SHA-256 해시 생성 → image_hash에 저장

### Storage + DB

- [ ] Storage 경로: `{moveId}/{photoType}/{room}_{timestamp}.{ext}`
- [ ] DB 레코드 생성 (photo_type, room, storage_path, image_hash, taken_at)
- [ ] signed URL로 이미지 표시
- [ ] signed URL 배치 조회 동작

### 사진 상세

- [ ] 사진 탭 → PhotoFullscreenViewer 오픈 (createPortal)
- [ ] 사진 풀 사이즈 표시 (핀치줌 1~4x, 더블탭 토글)
- [ ] 날짜 표시 (taken_at 또는 uploaded_at)
- [ ] 메모 인라인 편집 → 디바운스 1초 자동저장 (⋯ 메뉴에서 "메모 편집")
- [ ] 삭제 → DeletePhotoDialog (바텀시트) → soft delete → 목록에서 제거

### 약한 가이드

- [ ] 사진 0~2장인 방: RoomTipCard 표시
- [ ] 사진 3장+인 방: RoomTipCard 자동 숨김
- [ ] 사진 0장인 방: PhotoEmptyState (tipDetail 텍스트)
- [ ] 방 카드에 힌트 한 줄 표시

### 최근 삭제 (PhotoTrashPage)

- [ ] `/photos/trash` 라우트 동작
- [ ] iOS 대형 타이틀 + 2줄 서브텍스트
- [ ] 필터 칩: 활성=bg-primary white, 비활성=bg-black/[0.05] muted
- [ ] 72px 썸네일 + "방이름 · 메모" + timeAgo + daysLeft 표시
- [ ] daysLeft 3일 이하: primary 색상 강조
- [ ] 복구 버튼: 방 가득 차면 disabled + 토스트
- [ ] 영구삭제: DB + Storage 삭제
- [ ] 빈 상태: Trash2 아이콘 + 안내 문구
- [ ] 구분선: left 100px부터 (iOS 네이티브 패턴)

### 삭제 다이얼로그

- [ ] 바텀시트 스타일 (slideUp 200ms)
- [ ] overflow=true: 줄바꿈 경고 문구
- [ ] 캐시 워밍: PhotoGrid에서 useDeletedPhotos 미리 fetch → 깜빡임 없음

### 리포트

- [ ] 사진 1장+ 있을 때 "리포트 보기" 버튼 표시
- [ ] 사진 0장이면 리포트 버튼 숨김
- [ ] 리포트 페이지: 방별 사진 + 메모 표시
- [ ] 사진 0장인 방은 리포트에서 미표시
- [ ] 상단 요약: 날짜 + 총 사진 수 + 메모 건수
- [ ] 하단 TipCard: 보증금 분쟁 증거 안내

### 대시보드 연결

- [ ] PhotoPromptCard CTA → `/photos` 이동 (console.log 제거)
- [ ] DevTabBar 집기록 탭 → `/photos` active 상태

### 접근성

- [ ] PhotoTypeToggle: role="tablist" + aria-selected
- [ ] RoomCard: role="button" + aria-label
- [ ] PhotoFullscreenViewer: role="dialog" + aria-modal
- [ ] DeletePhotoDialog: role="alertdialog" + aria-describedby
- [ ] 업로드 중: aria-busy
- [ ] ESC 키로 PhotoFullscreenViewer / DeletePhotoDialog 닫기

---

## 15. 면접 대비 포인트

### "사진 증거력을 어떻게 확보했나요?"

> 3단계로 확보합니다.
>
> 1. SHA-256 해시: 원본 파일의 무결성 증명. 촬영 후 수정되지 않았음을 확인할 수 있음.
> 2. EXIF 촬영 일시: DateTimeOriginal을 추출해 taken_at에 별도 저장. "이 사진은 이 시점에 찍었다"의 근거. GPS는 DB 컬럼 추가 없이도 EXIF 원본에 보존되므로, 필요 시 원본 파일에서 확인 가능.
> 3. 서버 타임스탬프: uploaded_at은 서버 시각(now())으로 기록. 클라이언트 조작 불가.
>
> RFC 3161 타임스탬프 서비스도 검토했지만, 1인 사이드 프로젝트에서는 오버엔지니어링이라 판단.
> 대신 "이 3가지를 조합하면 일반적인 보증금 분쟁에서 충분한 증거력"이라는 실용적 결론.
> v1.1에서 이메일 리포트를 추가하면 제3자 서버(Gmail) 타임스탬프까지 확보 가능.

### "왜 signed URL인가요?"

> Supabase Storage의 private 버킷은 인증된 유저만 접근 가능합니다.
> DB에 전체 URL을 저장하면 시간이 지나서 URL이 만료되었을 때 이미지가 깨집니다.
> 그래서 DB에는 storage_path(상대 경로)만 저장하고, 화면에 보여줄 때
> createSignedUrl로 1시간짜리 임시 URL을 발급합니다.
> TanStack Query의 staleTime 30분으로 캐싱해서 불필요한 API 호출을 줄였고,
> 만료된 URL은 이미지 onError에서 자동 refetch하도록 처리했습니다.

### "여러 장 업로드 실패 처리는?"

> Promise.allSettled를 사용합니다. Promise.all은 하나라도 실패하면 전체가 reject되는데,
> 5장 중 1장만 네트워크 에러가 나도 전부 실패 처리되면 UX가 나쁩니다.
> allSettled은 각 프로미스의 결과를 독립적으로 받아서, 성공한 사진은 정상 저장하고
> 실패한 사진만 토스트로 알려줍니다.

### "Storage 업로드와 DB 저장이 분리되어 있는데, 정합성은?"

> Storage와 PostgreSQL은 다른 시스템이라 트랜잭션으로 묶을 수 없습니다.
> Storage 업로드 성공 → DB 저장 실패 시, catch 블록에서 Storage 파일을 삭제합니다 (best effort).
> 이 삭제마저 실패하면 orphan 파일이 남지만, 사진 데이터 특성상 용량이 크지 않고
> 주기적 정리 스크립트로 해결 가능합니다. DB 실패율 자체가 매우 낮아서
> 이 수준의 eventual consistency는 합리적인 트레이드오프입니다.

---

## 16. 다음 단계 연결

6단계 완료 후 → **7단계: AI 맞춤 가이드** (`docs/specs/07-ai-guide.md`)

- Supabase Edge Function + Claude API 연동
- 조건 조합별 캐싱 (ai_guide_cache 테이블)
- 항목 상세 페이지에 AI 가이드 표시 (custom_guide 컬럼)
- 프롬프트 설계 + 품질 튜닝
