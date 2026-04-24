import ExifReader from 'exifreader'

/**
 * 사진 EXIF에서 촬영 일시(DateTimeOriginal) 추출
 *
 * 왜: taken_at(촬영 시점)은 uploaded_at(서버 시각)과 별개로 증거력을 갖는다.
 * 오프라인에서 찍고 나중에 업로드해도 실제 촬영 시점 보존.
 * GPS는 이번 단계 제외 (DB에 컬럼 없음, taken_at이 보증금 분쟁에서 훨씬 더 중요).
 *
 * 추출 실패(EXIF 없음/파싱 실패) → null 반환. 업로드 자체는 계속 진행.
 */
export async function extractExifTakenAt(file: File): Promise<Date | null> {
  try {
    const tags = await ExifReader.load(file)
    const dateTag = tags['DateTimeOriginal']
    if (dateTag?.description) {
      // EXIF 날짜 형식: "2026:04:14 15:30:00" → ISO 호환
      const isoString = dateTag.description.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
      const parsed = new Date(isoString)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return null
  } catch {
    console.warn('[extractExifTakenAt] EXIF 추출 실패, taken_at=null')
    return null
  }
}
