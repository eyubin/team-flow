import { expect, test } from '@playwright/test'
import { createWorkspaceAndProject, csrfHeader, getTaskByTitle, registerNewUser } from './helpers.ts'

test('shows a conflict when the task changed elsewhere first', async ({ page }) => {
  await registerNewUser(page, 'conflict')
  const { projectId } = await createWorkspaceAndProject(page, 'Conflict')

  await page.getByLabel('New task').fill('Racing edits')
  await page.getByLabel('Status', { exact: true }).selectOption('TODO')
  await page.getByLabel('Priority', { exact: true }).selectOption('MEDIUM')
  await page.getByRole('button', { name: 'Create task' }).click()
  await expect(page.getByRole('button', { name: /Racing edits/ })).toBeVisible()

  const task = await getTaskByTitle(page, projectId, 'Racing edits')
  await page.getByRole('button', { name: /Racing edits/ }).click()
  await expect(page.getByLabel('Title')).toHaveValue('Racing edits')

  // Simulate another client saving a change to this task first, behind the UI's back.
  const response = await page.request.patch(`/api/tasks/${task.id}`, {
    headers: await csrfHeader(page),
    data: { version: task.version, title: 'Racing edits (changed elsewhere)', status: 'TODO', priority: 'MEDIUM' },
  })
  expect(response.ok()).toBe(true)

  // The UI still holds the stale version, so saving now should be rejected as a conflict.
  await page.getByLabel('Title').fill('Racing edits (my edit)')
  await page.getByRole('button', { name: 'Save task' }).click()

  await expect(page.getByRole('alert')).toContainText('changed on the server')

  await page.getByRole('button', { name: 'Reload task' }).click()
  await expect(page.getByLabel('Title')).toHaveValue('Racing edits (changed elsewhere)')
  await expect(page.getByRole('alert')).toHaveCount(0)
})
