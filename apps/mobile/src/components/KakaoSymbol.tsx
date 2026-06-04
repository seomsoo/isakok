import Svg, { Path } from 'react-native-svg'

interface KakaoSymbolProps {
  size?: number
  color?: string
}

// 카카오 공식 심볼(말풍선). 가이드상 형태·비율·색상 변경 불가 — 공식 형태 그대로 사용.
export function KakaoSymbol({ size = 18, color = '#000000' }: KakaoSymbolProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        fill={color}
        d="M9 1.5C4.582 1.5 1 4.302 1 7.758c0 2.235 1.488 4.194 3.747 5.314-.166.587-.6 2.128-.687 2.459-.108.41.15.404.316.294.13-.087 2.07-1.404 2.91-1.975.553.082 1.124.124 1.714.124 4.418 0 8-2.802 8-6.258S13.418 1.5 9 1.5z"
      />
    </Svg>
  )
}
