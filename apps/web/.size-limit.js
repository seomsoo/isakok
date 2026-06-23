// 번들 사이즈 가드 (스펙 13 §6-1). 현재 gzip 크기를 천장으로 시작 → 코드 스플리팅하며 래칫 다운.
// @size-limit/file(사이즈 전용)만 사용 — 로딩 실행시간(브라우저) 측정 없이 gzip 파일 크기만 게이트.
// 두 예산: initial entry(첫 진입 청크)만 보면 코드 스플리팅 후 lazy 청크 악화를 놓치므로 total JS도 함께.
export default [
  {
    name: 'initial entry (gzip)',
    path: 'dist/assets/index-*.js',
    limit: '345 KB',
    gzip: true,
  },
  {
    name: 'total JS (gzip)',
    path: 'dist/assets/*.js',
    limit: '345 KB',
    gzip: true,
  },
]
