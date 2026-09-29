import { expect, test } from '@playwright/test'

test('opens the host screen in ready state', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kaioke' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Pronto para iniciar uma sessão')
})
