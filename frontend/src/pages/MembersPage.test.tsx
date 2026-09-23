import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw/server.ts'
import { member, problem, workspace } from '../test/msw/handlers.ts'
import { renderWithProviders } from '../test/render.tsx'
import { MembersPage } from './MembersPage.tsx'

const withWorkspaces = http.get('/api/workspaces', () => HttpResponse.json([workspace]))
const withMembers = http.get('/api/workspaces/:workspaceId/members', () => HttpResponse.json([member]))

function renderMembers() {
  return renderWithProviders(<MembersPage />, {
    route: '/workspaces/workspace-1/members',
    path: '/workspaces/:workspaceId/members',
  })
}

describe('MembersPage', () => {
  it('lists the workspace members', async () => {
    server.use(withWorkspaces, withMembers)

    renderMembers()

    expect(await screen.findByRole('heading', { name: 'Members – Acme' })).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('grace@example.com')).toBeInTheDocument()
  })

  it('adds a member with the chosen role', async () => {
    let body: unknown
    server.use(
      withWorkspaces,
      withMembers,
      http.post('/api/workspaces/:workspaceId/members', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(member, { status: 201 })
      }),
    )

    const { user } = renderMembers()

    await user.type(await screen.findByLabelText('Email'), 'grace@example.com')
    await user.click(screen.getByLabelText('Role', { exact: true }))
    await user.click(await screen.findByRole('option', { name: 'Admin' }))
    await user.click(screen.getByRole('button', { name: 'Add member' }))

    expect(await screen.findByText('Member added')).toBeInTheDocument()
    await waitFor(() => expect(body).toEqual({ email: 'grace@example.com', role: 'ADMIN' }))
  })

  it('rejects an invalid email before calling the API', async () => {
    server.use(withWorkspaces, withMembers)

    const { user } = renderMembers()

    await user.type(await screen.findByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Add member' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address')
  })

  it('changes a member role', async () => {
    let patched: unknown
    server.use(
      withWorkspaces,
      withMembers,
      http.patch('/api/workspaces/:workspaceId/members/:userId', async ({ request }) => {
        patched = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const { user } = renderMembers()

    await user.click(await screen.findByLabelText('Role for Grace Hopper'))
    await user.click(await screen.findByRole('option', { name: 'Viewer' }))

    expect(await screen.findByText('Member role updated')).toBeInTheDocument()
    await waitFor(() => expect(patched).toEqual({ role: 'VIEWER' }))
  })

  it('removes a member only after the confirmation dialog is accepted', async () => {
    let deleted = false
    server.use(
      withWorkspaces,
      withMembers,
      http.delete('/api/workspaces/:workspaceId/members/:userId', () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const { user } = renderMembers()

    await user.click(await screen.findByRole('button', { name: 'Remove' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/Remove Grace Hopper from this workspace/)).toBeInTheDocument()
    expect(deleted).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(await screen.findByText('Member removed')).toBeInTheDocument()
    await waitFor(() => expect(deleted).toBe(true))
  })

  it('sorts members by name from the column header', async () => {
    const ada = { userId: 'user-3', email: 'ada@example.com', displayName: 'Ada Lovelace', role: 'ADMIN' as const }
    server.use(withWorkspaces, http.get('/api/workspaces/:workspaceId/members', () => HttpResponse.json([member, ada])))

    const { user } = renderMembers()

    const firstNameBefore = (await screen.findAllByRole('row'))[1]
    expect(within(firstNameBefore).getByText('Grace Hopper')).toBeInTheDocument()

    await user.click(screen.getByRole('columnheader', { name: /Member/ }))

    await waitFor(() => {
      const firstRow = screen.getAllByRole('row')[1]
      expect(within(firstRow).getByText('Ada Lovelace')).toBeInTheDocument()
    })
  })

  it('shows the forbidden page when the member list is not accessible', async () => {
    server.use(withWorkspaces, http.get('/api/workspaces/:workspaceId/members', () => problem(403, 'Nope')))

    renderMembers()

    expect(await screen.findByRole('heading', { name: /don't have permission to view this/ })).toBeInTheDocument()
  })
})
