import type { Page } from '@playwright/test'

export const DEMO_PASSWORD = 'TeamFlow-demo-123'
export const DEMO_ADMIN_EMAIL = 'demo-admin@teamflow.local'
export const DEMO_VIEWER_EMAIL = 'demo-viewer@teamflow.local'

type Profile = { id: string; email: string; displayName: string }

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

export async function registerNewUser(page: Page, prefix: string) {
  const suffix = uniqueSuffix()
  const email = `${prefix}-${suffix}@e2e.test`
  const password = 'Playwright-e2e-pass-1'
  const displayName = `${prefix} tester ${suffix}`

  await page.goto('/auth')
  await page.getByRole('button', { name: 'Need an account?' }).click()
  await page.getByLabel('Display name').fill(displayName)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Register', exact: true }).click()
  await page.getByRole('heading', { name: `Welcome, ${displayName}` }).waitFor()

  const response = await page.request.get('/api/auth/me')
  const profile = (await response.json()) as Profile
  return { email, password, displayName, id: profile.id }
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Sign out' }).waitFor()
}

export async function createWorkspaceAndProject(page: Page, namePrefix: string) {
  const suffix = uniqueSuffix()
  const workspaceName = `${namePrefix} workspace ${suffix}`
  const projectName = `${namePrefix} project ${suffix}`

  await page.goto('/dashboard')
  await page.getByLabel('New workspace').fill(workspaceName)
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await page.getByLabel('New project').fill(projectName)
  await page.getByRole('button', { name: 'Create project' }).click()

  await page.getByRole('link', { name: `Open task board for ${projectName}` }).click()
  await page.waitForURL(/\/projects\/.+\/tasks/)

  return { workspaceName, projectName, projectId: projectIdFromUrl(page.url()) }
}

export function projectIdFromUrl(url: string) {
  const match = /\/projects\/([^/]+)\/tasks/.exec(url)
  if (!match) throw new Error(`No project id found in URL: ${url}`)
  return match[1]
}

export async function csrfHeader(page: Page) {
  const cookies = await page.context().cookies()
  const token = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? ''
  return { 'X-XSRF-TOKEN': token }
}

export async function getTaskByTitle(page: Page, projectId: string, title: string) {
  const response = await page.request.get(`/api/projects/${projectId}/tasks?size=100`)
  const body = (await response.json()) as { content: { id: string; title: string; version: number }[] }
  const found = body.content.find((task) => task.title === title)
  if (!found) throw new Error(`Task "${title}" not found in project ${projectId}`)
  return found
}
