const MAX_DIMENSION = 1920
const QUALITY = 0.8

/**
 * 긴 변 > 1920px인 이미지를 WebP 80%로 리사이즈.
 * 긴 변 <= 1920px이면 원본 그대로 반환 (re-encode 안 함).
 */
export async function resizeImage(file: File): Promise<File> {
  const img = await loadImage(file)

  if (img.width <= MAX_DIMENSION && img.height <= MAX_DIMENSION) {
    return file
  }

  const ratio = MAX_DIMENSION / Math.max(img.width, img.height)
  const width = Math.round(img.width * ratio)
  const height = Math.round(img.height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('[resizeImage] canvas context 생성 실패')

  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('[resizeImage] toBlob 실패'))),
      'image/webp',
      QUALITY,
    )
  })

  const stem = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${stem}.webp`, { type: 'image/webp' })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('[resizeImage] 이미지 로드 실패'))
    }
    img.src = url
  })
}
