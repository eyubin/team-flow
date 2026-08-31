import { expect, test, type Page } from '@playwright/test'
import { createWorkspaceAndProject, registerNewUser } from './helpers.ts'

async function createTask(page: Page, title: string, status: string, priority: string) {
  await page.getByLabel('New task').fill(title)
  await page.getByLabel('Status', { exact: true }).selectOption(status)
  await page.getByLabel('Priority', { exact: true }).selectOption(priority)
  await page.getByRole('button', { name: 'Create task' }).click()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()
}

test('filters the task board by status', async ({ page }) => {
  await registerNewUser(page, 'filter')
  await createWorkspaceAndProject(page, 'Filter')

  await createTask(page, 'Backlog item', 'TODO', 'LOW')
  await createTask(page, 'Active item', 'IN_PROGRESS', 'HIGH')
  await createTask(page, 'Finished item', 'DONE', 'MEDIUM')

  await page.getByLabel('Filter status').selectOption('IN_PROGRESS')
  await page.getByRole('button', { name: 'Apply filters' }).click()

  await expect(page.getByRole('button', { name: /Active item/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Backlog item/ })).not.toBeVisible()
  await expect(page.getByRole('button', { name: /Finished item/ })).not.toBeVisible()

  await page.getByRole('button', { name: 'Clear' }).click()
  await page.getByRole('button', { name: 'Apply filters' }).click()

  await expect(page.getByRole('button', { name: /Backlog item/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Finished item/ })).toBeVisible()
})
