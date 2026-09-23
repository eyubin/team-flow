import { expect, test, type Page } from '@playwright/test'
import { chooseOption, createWorkspaceAndProject, registerNewUser } from './helpers.ts'

async function createTask(page: Page, title: string, status: string, priority: string) {
  await page.getByLabel('New task').fill(title)
  await chooseOption(page, 'Status', status)
  await chooseOption(page, 'Priority', priority)
  await page.getByRole('button', { name: 'Create task' }).click()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible()
}

test('filters the task board by status', async ({ page }) => {
  await registerNewUser(page, 'filter')
  await createWorkspaceAndProject(page, 'Filter')

  await createTask(page, 'Backlog item', 'To do', 'Low')
  await createTask(page, 'Active item', 'In progress', 'High')
  await createTask(page, 'Finished item', 'Done', 'Medium')

  await chooseOption(page, 'Filter status', 'In progress')
  await page.getByRole('button', { name: 'Apply filters' }).click()

  await expect(page.getByRole('button', { name: /Active item/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Backlog item/ })).not.toBeVisible()
  await expect(page.getByRole('button', { name: /Finished item/ })).not.toBeVisible()

  await page.getByRole('button', { name: 'Clear' }).click()
  await page.getByRole('button', { name: 'Apply filters' }).click()

  await expect(page.getByRole('button', { name: /Backlog item/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Finished item/ })).toBeVisible()
})
