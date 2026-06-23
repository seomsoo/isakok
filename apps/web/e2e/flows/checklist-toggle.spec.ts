import { test, expect } from '@playwright/test'
import { prefillMoveAndAuth } from '../support/prefill'
import { checkA11y } from '../fixtures/axe'

// #2 항목 상세 진입 → 완료 토글(낙관적) → 대시보드 할 일에서 소거(progress 갱신)
// 시작 상태(move+체크리스트)는 prefill API로 세팅 — 온보딩 UI는 flow#1이 검증하므로 여기선 중복 안 함.
test('항목 상세에서 완료 토글하면 대시보드 할 일에서 사라진다', async ({ page }) => {
  await prefillMoveAndAuth(page)
  await page.goto('/dashboard')

  // 대시보드 할 일(액션) 항목 로딩 대기 — 첫 항목의 라벨("{제목} 완료 처리") 캡처
  const firstItem = page.locator('a[href^="/checklist/"]').first()
  await expect(firstItem).toBeVisible({ timeout: 15_000 })
  const itemLabel = await firstItem.getByRole('checkbox').getAttribute('aria-label')
  if (!itemLabel) throw new Error('첫 항목 체크박스의 aria-label을 찾지 못했어요')

  // 상세 진입 — 제목 영역 클릭(체크박스는 stopPropagation으로 토글만 동작)
  await firstItem.locator('p').first().click()
  await page.waitForURL(/\/checklist\//)

  // 상세에서 완료 토글 → 낙관적 반영(버튼 라벨 전환)
  const completeBtn = page.getByRole('button', { name: '완료로 표시' })
  await expect(completeBtn).toBeVisible()
  await checkA11y(page, '항목 상세')
  await completeBtn.click()
  await expect(page.getByRole('button', { name: '다시 할 일로 되돌리기' })).toBeVisible()

  // 대시보드 복귀 → 방금 완료한 그 항목은 할 일 목록에서 사라진다(progress/목록 갱신)
  await page.getByRole('button', { name: '뒤로 가기' }).click()
  await page.waitForURL(/\/dashboard/)
  await expect(page.getByRole('checkbox', { name: itemLabel })).toBeHidden({ timeout: 15_000 })

  // 동적 상태(시트) a11y 게이트 — 정적 페이지만으론 모달/시트가 빠진다(스펙 13 §5-3·§15).
  // 설정 → '이사 정보 수정' 시트를 열어 열린 상태에서도 axe 위반 0건을 단언(기존 여정에 상태 1개 추가).
  await page.goto('/settings')
  const editBtn = page.getByRole('button', { name: /이사 정보 수정/ })
  await expect(editBtn).toBeVisible({ timeout: 15_000 })
  await editBtn.click()
  await expect(page.getByRole('heading', { name: '이사 정보 수정' })).toBeVisible()
  await checkA11y(page, '이사 정보 수정 시트(동적 상태)')
})
