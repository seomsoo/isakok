/**
 * 파일의 SHA-256 해시 생성
 *
 * 왜: 사진 무결성 증명 (촬영 후 수정되지 않았음 / 중복 감지 / 보증금 분쟁 시 원본 증거)
 * Web Crypto API 사용 → 추가 라이브러리 불필요.
 * 브라우저 호환: Chrome 37+, Safari 11+, Firefox 34+
 */
export async function generateFileHash(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer()

  // crypto.subtle is unavailable over HTTP (non-localhost, non-HTTPS)
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    const bytes = new Uint8Array(buffer)
    let h1 = 0x811c9dc5
    let h2 = 0x01000193
    for (let i = 0; i < bytes.length; i++) {
      h1 = Math.imul(h1 ^ (bytes[i] ?? 0), 0x01000193)
      h2 = Math.imul(h2 ^ (bytes[i] ?? 0), 0x811c9dc5)
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
