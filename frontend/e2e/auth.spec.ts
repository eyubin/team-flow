import { expect, test } from '@playwright/test'
import { registerNewUser } from './helpers.ts'

test('registers, stays signed in across a reload, and signs out', async ({ page }) => {
  const user = await registerNewUser(page, 'auth')

  await page.reload()
  await expect(page.getByRole('heading', { name: `Welcome, ${user.displayName}` })).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})
