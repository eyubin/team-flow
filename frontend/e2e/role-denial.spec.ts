import { expect, test } from '@playwright/test'
import { DEMO_PASSWORD, DEMO_VIEWER_EMAIL, signIn } from './helpers.ts'

test('a viewer can read but cannot modify a task', async ({ page }) => {
  await signIn(page, DEMO_VIEWER_EMAIL, DEMO_PASSWORD)
  await page.goto('/dashboard')

  await page.getByRole('link', { name: 'Open task board for Demo Project' }).click()
  await page.waitForURL(/\/projects\/.+\/tasks/)

  const taskButton = page.getByRole('button', { name: /Review the task board/ })
  await expect(taskButton).toBeVisible()
  await taskButton.click()

  await page.getByLabel('Title').fill('Viewer should not be able to save this')
  await page.getByRole('button', { name: 'Save task' }).click()

  await expect(page.getByRole('alert')).toContainText("don't have permission")
})
