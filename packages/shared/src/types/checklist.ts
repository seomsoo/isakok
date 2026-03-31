/**
 * 가이드 유형 (항목 중요도)
 * DB: master_checklist_items.guide_type CHECK 제약조건
 * UI: critical=빨강 뱃지, warning=앰버 뱃지, tip=틸 뱃지
 */
export const GUIDE_TYPES = {
  TIP: 'tip',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const

export type GuideType = (typeof GUIDE_TYPES)[keyof typeof GUIDE_TYPES]

/**
 * 체크리스트 카테고리
 * DB: master_checklist_items.category
 * UI: 항목 상세 화면에서 카테고리 태그로 표시
 */
export const CATEGORIES = {
  업체_이사방법: '업체/이사방법',
  정리_폐기: '정리/폐기',
  행정_서류: '행정/서류',
  공과금_정산: '공과금/정산',
  통신_구독: '통신/구독',
  짐싸기_포장: '짐싸기/포장',
  집상태기록: '집상태기록',
  이사당일: '이사당일',
  입주후: '입주후',
} as const

export type CategoryType = (typeof CATEGORIES)[keyof typeof CATEGORIES]
