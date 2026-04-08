/**
 * 타임라인 카테고리 필터 칩 매핑
 * DB 카테고리(9개, 단축명)를 UI용 칩으로 간소화
 */
export const CATEGORY_CHIP_MAP: { label: string; dbCategories: string[] }[] = [
  { label: '전체', dbCategories: [] },
  { label: '업체', dbCategories: ['업체'] },
  { label: '정리', dbCategories: ['정리', '포장'] },
  { label: '행정', dbCategories: ['행정'] },
  { label: '정산', dbCategories: ['정산'] },
  { label: '통신', dbCategories: ['통신'] },
  { label: '기록', dbCategories: ['기록'] },
  { label: '당일/입주', dbCategories: ['당일', '입주'] },
]
