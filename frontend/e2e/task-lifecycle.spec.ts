import { expect, test } from '@playwright/test'
import { chooseOption, createWorkspaceAndProject, registerNewUser } from './helpers.ts'

test('signs in, creates a project, and creates an assigned task', async ({ page }) => {
  const user = await registerNewUser(page, 'lifecycle')
  await createWorkspaceAndProject(page, 'Lifecycle')

  await page.getByLabel('New task').fill('Ship the release notes')
  await chooseOption(page, 'Status', 'In progress')
  await chooseOption(page, 'Priority', 'High')
  await page.getByLabel('Assignee ID', { exact: true }).fill(user.id)
  await page.getByRole('button', { name: 'Create task' }).click()

  const taskButton = page.getByRole('button', { name: /Ship the release notes/ })
  await expect(taskButton).toBeVisible()

  // Status and priority are their own columns now, so they read off the row.
  const taskRow = page.getByRole('row', { name: /Ship the release notes/ })
  await expect(taskRow).toContainText('In progress')
  await expect(taskRow).toContainText('HIGH')

  await taskButton.click()
  await expect(page.getByLabel('Task assignee ID')).toHaveValue(user.id)
})
