import { type Page, expect } from '@playwright/test'

/**
 * 온보딩 3스텝을 완료해 대시보드까지 도달한다 (두 플로우 공통 셋업).
 * 호출 전 `/onboarding`으로 이동돼 있어야 한다(step 1).
 * 각 테스트가 자기 move를 만들어 독립 실행되게 한다 — 공유 익명 유저 + 로컬 DB라 playwright workers:1로 직렬화.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  // Step 1: 이사 예정일 — 범위 내(비활성/타월 제외) 당월 날짜 중 가장 먼 미래일 선택(밀린 항목 확보)
  await expect(page.getByRole('heading', { name: /이사 예정일이/ })).toBeVisible()
  await page.locator('.rdp-day:not(.rdp-disabled):not(.rdp-outside) .rdp-day_button').last().click()
  const next1 = page.getByRole('button', { name: '다음' })
  await expect(next1).toBeEnabled()
  await next1.click()

  // Step 2: 주거 유형
  await expect(page.getByRole('heading', { name: /어떤 집에서/ })).toBeVisible()
  await page.getByRole('radio', { name: '원룸' }).click()
  await page.getByRole('button', { name: '다음' }).click()

  // Step 3: 계약 유형 + 이사 방법
  await expect(page.getByRole('heading', { name: '계약 유형은?' })).toBeVisible()
  await page.getByRole('radio', { name: '월세' }).click()
  await page.getByRole('radio', { name: '용달' }).click()
  await page.getByRole('button', { name: '맞춤 체크리스트 만들기' }).click()

  // 제출 → /pre-check(밀린 항목 표시) 또는 바로 /dashboard.
  await page.waitForURL(/\/(pre-check|dashboard)/)
  // pre-check는 로딩 후 skip 버튼이 나타난다(밀린 항목 있을 때). 짧게 기다려 있으면 클릭,
  // 없으면(밀린 항목 0) pre-check가 자동으로 대시보드로 이동한다.
  const skip = page.getByRole('button', { name: '건너뛰고 대시보드로 이동' })
  try {
    await skip.waitFor({ state: 'visible', timeout: 5000 })
    await skip.click()
  } catch {
    /* skip 없음 = 자동 대시보드 이동 */
  }
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
}
