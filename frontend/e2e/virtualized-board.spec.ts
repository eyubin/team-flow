import { expect, test } from '@playwright/test'
import { createWorkspaceAndProject, csrfHeader, registerNewUser } from './helpers.ts'

const TASK_COUNT = 60

test('windows the task rows on a long board', async ({ page }) => {
  await registerNewUser(page, 'virtual')
  const { projectId } = await createWorkspaceAndProject(page, 'Virtual')

  // Seeded through the API: creating 60 tasks through the form would dominate
  // the runtime and is not what this spec is about.
  const headers = await csrfHeader(page)
  for (let index = 0; index < TASK_COUNT; index++) {
    const response = await page.request.post(`/api/projects/${projectId}/tasks`, {
      headers,
      data: { title: `Seeded task ${String(index).padStart(3, '0')}`, status: 'TODO', priority: 'LOW' },
    })
    expect(response.ok()).toBe(true)
  }

  await page.reload()

  // The board lists newest first, so the last task seeded is at the top.
  const newest = `Seeded task ${String(TASK_COUNT - 1).padStart(3, '0')}`
  const oldest = 'Seeded task 000'
  await expect(page.getByRole('button', { name: newest })).toBeVisible()

  // Only a window of rows is in the DOM, not all 60.
  const renderedCount = await page.getByRole('button', { name: /^Seeded task \d+$/ }).count()
  expect(renderedCount).toBeGreaterThan(0)
  expect(renderedCount).toBeLessThan(TASK_COUNT)
  await expect(page.getByRole('button', { name: oldest })).toHaveCount(0)

  // Scrolling the container brings the far end of the list into the DOM.
  await page.getByRole('table').evaluate((table) => {
    const container = table.parentElement!
    container.scrollTop = container.scrollHeight
  })

  await expect(page.getByRole('button', { name: oldest })).toBeVisible()
})
