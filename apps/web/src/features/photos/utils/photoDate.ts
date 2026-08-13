import type { PropertyPhoto } from '@/services/photos'

/** 사진 대표 시각: 촬영 → 업로드 → 생성 순 우선 */
export function photoDisplayDate(photo: PropertyPhoto): string | null {
  return photo.taken_at ?? photo.uploaded_at ?? photo.created_at
}

/** 'Y년 M월 D일' */
export function formatKoreanDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 'Y년 M월 D일 HH:mm' */
export function formatKoreanDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${formatKoreanDate(d)} ${hh}:${mm}`
}

/** '오전/오후 h:mm' */
export function formatKoreanTime12h(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const h = d.getHours()
  const period = h < 12 ? '오전' : '오후'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${h12}:${String(d.getMinutes()).padStart(2, '0')}`
}
