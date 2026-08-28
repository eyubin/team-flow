import { expect, test } from '@playwright/test'
import { createWorkspaceAndProject, registerNewUser } from './helpers.ts'

test('signs in, creates a project, and creates an assigned task', async ({ page }) => {
  const user = await registerNewUser(page, 'lifecycle')
  await createWorkspaceAndProject(page, 'Lifecycle')

  await page.getByLabel('New task').fill('Ship the release notes')
  await page.getByLabel('Status', { exact: true }).selectOption('IN_PROGRESS')
  await page.getByLabel('Priority', { exact: true }).selectOption('HIGH')
  await page.getByLabel('Assignee ID', { exact: true }).fill(user.id)
  await page.getByRole('button', { name: 'Create task' }).click()

  const taskButton = page.getByRole('button', { name: /Ship the release notes/ })
  await expect(taskButton).toBeVisible()
  await expect(taskButton).toContainText('IN_PROGRESS')
  await expect(taskButton).toContainText('HIGH')

  await taskButton.click()
  await expect(page.getByLabel('Task assignee ID')).toHaveValue(user.id)
})
