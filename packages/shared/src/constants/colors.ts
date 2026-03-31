/**
 * 디자인 토큰 (설계 결정사항 통합 v2 §2-3)
 * Tailwind는 CSS @theme에서 관리하지만,
 * JS에서 동적으로 색상이 필요한 경우 (차트, 아이콘 등) 이 상수를 사용
 */
export const COLORS = {
  primary: '#0D9488',
  secondary: '#333344',
  tertiary: '#E0F2F1',
  neutral: '#F8F7F5',
  warning: '#F97316',
  critical: '#EF4444',
  success: '#10B981',
} as const
