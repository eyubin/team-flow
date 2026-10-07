import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw/server.ts'
import { problem, project, workspace } from '../test/msw/handlers.ts'
import { renderWithProviders } from '../test/render.tsx'
import { DashboardPage } from './DashboardPage.tsx'

const withWorkspaces = http.get('/api/workspaces', () => HttpResponse.json([workspace]))
const withProjects = http.get('/api/workspaces/:workspaceId/projects', () => HttpResponse.json([project]))

describe('DashboardPage', () => {
  it('invites the user to create a workspace when they have none', async () => {
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('No workspaces yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeInTheDocument()
  })

  it('lists the projects of the first workspace', async () => {
    server.use(withWorkspaces, withProjects)

    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('Apollo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open task board for Apollo' })).toHaveAttribute(
      'href',
      '/projects/project-1/tasks',
    )
  })

  it('creates a workspace and reports success', async () => {
    let created: unknown
    server.use(
      http.post('/api/workspaces', async ({ request }) => {
        created = await request.json()
        return HttpResponse.json(workspace, { status: 201 })
      }),
    )

    const { user } = renderWithProviders(<DashboardPage />)

    await user.type(await screen.findByLabelText('New workspace'), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Create workspace' }))

    expect(await screen.findByText('Workspace created')).toBeInTheDocument()
    await waitFor(() => expect(created).toEqual({ name: 'Acme' }))
  })

  it('rejects an empty workspace name before calling the API', async () => {
    const { user } = renderWithProviders(<DashboardPage />)

    await user.click(await screen.findByRole('button', { name: 'Create workspace' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required')
  })

  it('shows a retry banner when workspaces cannot be loaded', async () => {
    server.use(http.get('/api/workspaces', () => problem(500, 'Boom')))

    renderWithProviders(<DashboardPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your workspaces.")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows the forbidden page when the dashboard is not accessible', async () => {
    server.use(http.get('/api/workspaces', () => problem(403, 'Nope')))

    renderWithProviders(<DashboardPage />)

    expect(await screen.findByRole('heading', { name: /don't have permission to view this/ })).toBeInTheDocument()
  })
})
