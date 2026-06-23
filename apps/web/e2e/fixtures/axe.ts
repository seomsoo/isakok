import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

// WCAG 2.1 AA까지 — best-practice 룰은 제외(warn-only 성격, 게이트 아님). (스펙 13 §5-3)
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * 현재 페이지/상태의 접근성 위반을 수집해 0건이 아니면 실패시킨다(fail 게이트).
 * 정적 페이지뿐 아니라 모달·시트 같은 동적 상태에서도 호출한다.
 * @param context 위반 메시지에 붙일 위치 라벨(예: '대시보드', '온보딩 step2')
 */
export async function checkA11y(page: Page, context?: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // color-contrast는 기존 디자인 토큰·캘린더 CSS 부채(STATUS "text-muted 대비" 기존 이슈)라
    // 앱 전반 변경이 필요 → 13단계 스코프 밖. 별도 a11y/디자인 패스에서 처리. 구조적 위반은 계속 게이트.
    .disableRules(['color-contrast'])
    .analyze()
  const label = context ? ` @ ${context}` : ''
  const ids = results.violations.map((v) => `${v.id}(${v.nodes.length})`).join(', ')
  expect(results.violations, `a11y violations${label}: ${ids}`).toEqual([])
}
