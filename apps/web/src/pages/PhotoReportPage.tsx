import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, Upload } from 'lucide-react'
import { ROUTES, ROOM_META } from '@moving/shared'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { usePhotos } from '@/features/photos/hooks/usePhotos'
import { useSignedUrls } from '@/features/photos/hooks/useSignedUrls'
import { Skeleton } from '@/shared/components/Skeleton'
import { ReportHeader } from '@/features/photos/components/ReportHeader'
import { ReportRoomSection } from '@/features/photos/components/ReportRoomSection'
import { PhotoFullscreenViewer } from '@/features/photos/components/PhotoFullscreenViewer'
import { useToast } from '@/shared/components/ToastProvider'
import type { PhotoType, PropertyPhoto } from '@/services/photos'

function photoDate(p: PropertyPhoto): Date | null {
  const iso = p.taken_at ?? p.uploaded_at ?? p.created_at
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatGeneratedAt(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  const h = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  return `${y}년 ${m}월 ${d}일 ${h}:${min} 확인`
}

export function PhotoReportPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const [selected, setSelected] = useState<PropertyPhoto | null>(null)

  const { data: move, isPending } = useCurrentMove()
  const queryType = searchParams.get('type') as PhotoType | null
  const photoType: PhotoType = queryType === 'move_out' ? 'move_out' : 'move_in'

  const { data: photos = [], isLoading: isPhotosLoading } = usePhotos(move?.id, photoType)
  const { data: urlMap } = useSignedUrls(photos.map((p) => p.storage_path))

  if (isPending || isPhotosLoading) {
    return (
      <main className="min-h-dvh bg-neutral">
        <div className="pt-[env(safe-area-inset-top)]" />
        <div className="h-[52px]" />
        <div className="mx-4 mt-1 space-y-2">
          <Skeleton className="h-[180px] rounded-[20px]" />
          <Skeleton className="h-[260px] rounded-[20px]" />
          <Skeleton className="h-[200px] rounded-[20px]" />
        </div>
      </main>
    )
  }
  if (!move) return <Navigate to={ROUTES.LANDING} replace />
  if (photos.length === 0) return <Navigate to={`/photos?type=${photoType}`} replace />

  const earliest =
    photos
      .map(photoDate)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null

  const memoCount = photos.filter((p) => p.memo && p.memo.trim().length > 0).length
  const roomCount = ROOM_META.filter((r) => photos.some((p) => p.room === r.type)).length

  async function handleShare() {
    const typeLabel = photoType === 'move_in' ? '입주' : '퇴실'
    const text = `${typeLabel} 집 상태 리포트\n사진 ${photos.length}장 · 메모 ${memoCount}개 · 공간 ${roomCount}곳\n\n이사일정 · 집기록 리포트`

    if (navigator.share) {
      try {
        await navigator.share({ title: `${typeLabel} 집 상태 리포트`, text })
      } catch {
        // user cancelled share
      }
    } else {
      await navigator.clipboard.writeText(text)
      toast.success('리포트 내용이 복사되었어요')
    }
  }

  return (
    <main className="relative min-h-dvh bg-neutral">
      {/* Safe area + App bar */}
      <div className="pt-[env(safe-area-inset-top)]" />
      <div className="flex h-[52px] shrink-0 items-center justify-between px-1">
        <button
          type="button"
          onClick={() => navigate(`/photos?type=${photoType}`)}
          aria-label="뒤로가기"
          className="flex h-11 w-11 items-center justify-center text-secondary"
        >
          <ChevronLeft size={22} strokeWidth={2.2} />
        </button>
        <span className="text-[16px] font-semibold tracking-tight text-secondary">리포트</span>
        <div className="w-11" />
      </div>

      {/* Scrollable content */}
      <div className="pb-44">
        <ReportHeader
          photoType={photoType}
          earliestDate={earliest}
          totalCount={photos.length}
          memoCount={memoCount}
          roomCount={roomCount}
        />

        <div className="mt-2 space-y-2">
          {ROOM_META.map((room) => {
            const roomPhotos = photos.filter((p) => p.room === room.type)
            if (roomPhotos.length === 0) return null
            return (
              <ReportRoomSection
                key={room.type}
                room={room}
                photos={roomPhotos}
                urlMap={urlMap}
                onPhotoPress={setSelected}
              />
            )
          })}
        </div>

        {/* Tip card */}
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl bg-tertiary/40 px-4 py-3.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white">
            <ShieldCheck size={14} strokeWidth={1.3} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-[13.5px] font-semibold leading-snug tracking-tight text-secondary">
              이 기록은 보증금 분쟁 시 증거로 활용할 수 있어요
            </p>
            <p className="mt-1 text-[12px] leading-relaxed tracking-tight text-muted">
              모든 사진은 SHA-256 해시로 원본 무결성이 검증돼요.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pb-3 pt-5 text-center text-[11.5px] leading-relaxed tracking-tight text-placeholder">
          <p>{formatGeneratedAt()}</p>
          <p className="mt-0.5">이사일정 · 집기록 리포트</p>
        </div>
      </div>

      {/* Sticky share bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 pb-[env(safe-area-inset-bottom)]">
        <div className="pointer-events-none h-[22px] bg-gradient-to-t from-neutral to-transparent" />
        <div className="bg-neutral px-4 pb-3.5 pt-2.5">
          <button
            type="button"
            onClick={handleShare}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-primary text-[16px] font-bold tracking-tight text-white shadow-[0_4px_14px_rgba(15,118,110,0.25)] active:bg-primary/90 transition-colors"
          >
            <Upload size={17} strokeWidth={1.8} />
            리포트 공유하기
          </button>
        </div>
      </div>

      {/* Fullscreen viewer */}
      {selected && (
        <PhotoFullscreenViewer
          photo={selected}
          signedUrl={urlMap?.[selected.storage_path]}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  )
}
