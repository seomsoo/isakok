export interface AiGuideConditions {
  housing_type: '원룸' | '오피스텔' | '빌라' | '아파트' | '투룸+'
  contract_type: '월세' | '전세'
  move_type: '용달' | '반포장' | '포장' | '자가용'
}

export interface GenerateAiGuideRequest {
  moveId: string
}

export type GenerateAiGuideResponse =
  | { status: 'ok'; source: 'cache_hit' | 'generated'; updated: number }
  | {
      status: 'error'
      code: 'TIMEOUT' | 'PARSE_FAIL' | 'API_FAIL' | 'INVALID_INPUT' | 'NOT_FOUND'
    }

export interface AiGeneratedGuide {
  master_item_id: string
  custom_guide: string
}
