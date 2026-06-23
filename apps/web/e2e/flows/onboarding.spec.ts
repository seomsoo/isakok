import { test, expect } from '@playwright/test'
import { completeOnboarding } from '../support/onboarding'
import { checkA11y } from '../fixtures/axe'

// #1 온보딩 → 체크리스트 생성 → (pre-check) → 대시보드
test('온보딩을 마치면 체크리스트가 생성되고 대시보드에 도달한다', async ({ page }) => {
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: /이사 예정일이/ })).toBeVisible()
  await checkA11y(page, '온보딩 step1')

  await completeOnboarding(page)

  // 진행률 카드(D-day)가 보이면 move + 체크리스트가 트랜잭션으로 생성된 것(대시보드는 move 없이 못 옴)
  await expect(page.getByRole('img', { name: /진행률/ })).toBeVisible()
  await checkA11y(page, '대시보드')
})
