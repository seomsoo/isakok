interface LinkMetaEntry {
  name: string
  description: string
}

/**
 * guide_url 도메인별 표시용 메타데이터
 * OG 크롤러 대신 하드코딩 — 링크가 4~5개뿐이고 서버 프록시 만들 비용이 크기 때문
 */
export const LINK_META: Record<string, LinkMetaEntry> = {
  'gov.kr': { name: '정부24', description: '민원 신청 및 결과 확인' },
  '15990903.or.kr': { name: '폐가전 무상수거', description: '전자제품 무상 방문 수거 예약' },
  'zimssa.com': { name: '짐싸', description: '이사 견적 비교 플랫폼' },
  'daangn.com': { name: '당근마켓', description: '중고거래로 짐 줄이기' },
  'citywaste.or.kr': { name: '대형폐기물 신고', description: '품목별 스티커 및 배출일 신청' },
  'khug.or.kr': { name: 'HUG 주택도시보증공사', description: '전세보증보험 조회/해지' },
  'shop.kt.com': { name: 'KT Shop', description: '인터넷 이전/해지 신청' },
  'soomgo.com': { name: '숨고', description: '입주청소 견적 비교' },
  'epost.go.kr': { name: '우체국', description: '주거이전 우편물 전달 서비스' },
  'online.kepco.co.kr': { name: '한전ON', description: '전기요금 조회/정산' },
  'seoulgas.co.kr': { name: '서울도시가스', description: '가스 사용 중지/개통 신청' },
}

/**
 * URL에서 도메인을 추출해 매핑된 표시 정보를 반환
 * 매핑이 없으면 도메인명을 그대로 표시
 */
export function getLinkMeta(url: string): LinkMetaEntry {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '')
    return LINK_META[domain] ?? { name: domain, description: url }
  } catch {
    return { name: url, description: '' }
  }
}
