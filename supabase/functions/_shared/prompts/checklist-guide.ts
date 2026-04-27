interface AiGuideConditions {
  housing_type: string
  contract_type: string
  move_type: string
}

interface PromptItem {
  master_item_id: string
  title: string
  guide_content: string
}

interface AiGeneratedGuide {
  master_item_id: string
  custom_guide: string
}

export const CHECKLIST_GUIDE_PROMPT_VERSION = '1.0.1'

export function buildChecklistGuidePrompt({
  conditions,
  items,
}: {
  conditions: AiGuideConditions
  items: PromptItem[]
}): string {
  return `당신은 한국 이사 도우미 앱 "이사콕"의 가이드 작성자입니다.
아래 유저 조건과 체크리스트 항목들을 바탕으로, 각 항목의 기존 가이드를 유저 상황에 맞게 재작성해주세요.

## 유저 조건
- 주거 유형: ${conditions.housing_type}
- 계약 유형: ${conditions.contract_type}
- 이사 방법: ${conditions.move_type}

## 작성 규칙
1. 각 항목 custom_guide는 한국어 2~4문장.
2. 각 항목은 반드시 해당 항목의 title과 guide만 근거로 작성. 다른 항목의 절차, 기관명, URL, 법적 주의사항을 섞지 마세요.
3. 원본 guide_content에 없는 새 절차, 새 기관명, 새 URL, 새 금액, 새 법적 조언은 추가하지 마세요.
4. 원본 guide_content에 있는 금액, 법조문, 기관명, 전화번호, URL은 절대 변경하지 말고 그대로 인용.
5. 조건(주거/계약/이사방법)과 직접 관련 있는 항목만 그 조건을 반영. 관련 없는 항목은 원본 의미를 유지하며 간결히 풀어쓰세요.
6. 이사 경험이 없는 유저도 이해할 수 있게 전문 용어는 짧게 풀어서 설명하되, 원본에 없는 전문 절차를 새로 추가하지 마세요.
7. 응답은 반드시 아래 JSON 형식만 반환. 마크다운 코드블록(\`\`\`), 설명, 주석 금지.
8. 입력 항목의 모든 master_item_id를 응답 guides 배열에 포함. 누락 금지.
9. 문장 톤: "~해요", "~하세요" 같은 간결한 존댓말.

## 항목 목록
${items.map((i) => `- master_item_id: ${i.master_item_id}\n  title: ${i.title}\n  guide: ${i.guide_content}`).join('\n\n')}

## 출력 형식 (이 JSON만 반환)
{"guides": [{"master_item_id": "...", "custom_guide": "..."}]}
`
}

export function parseResponse(content: string): unknown {
  try {
    const cleaned = content.trim().replace(/^```json\n?|\n?```$/g, '')
    return JSON.parse(cleaned)
  } catch (err) {
    const e = new Error(`Parse failed: ${(err as Error).message}`)
    e.name = 'ParseError'
    throw e
  }
}

export function normalizeGuides(parsed: unknown, expectedIds: Set<string>): AiGeneratedGuide[] {
  if (!parsed || typeof parsed !== 'object') {
    const e = new Error('Response root is not object')
    e.name = 'ParseError'
    throw e
  }
  const guides = (parsed as { guides?: unknown }).guides
  if (!Array.isArray(guides)) {
    const e = new Error('guides is not array')
    e.name = 'ParseError'
    throw e
  }

  const result: AiGeneratedGuide[] = []
  const seen = new Set<string>()

  for (const g of guides) {
    if (!g || typeof g !== 'object') continue
    const id = (g as Record<string, unknown>).master_item_id
    const text = (g as Record<string, unknown>).custom_guide
    if (typeof id !== 'string') continue
    if (typeof text !== 'string') continue
    if (!expectedIds.has(id)) continue
    if (seen.has(id)) continue
    if (text.length === 0 || text.length > 1000) continue
    seen.add(id)
    result.push({ master_item_id: id, custom_guide: text })
  }

  return result
}
