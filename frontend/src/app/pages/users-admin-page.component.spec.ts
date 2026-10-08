import { screen, waitFor, within } from '@testing-library/angular'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/msw/server'
import { adminProfile, adminUser, problem, profile } from '../../test/msw/handlers'
import { renderWithProviders } from '../../test/render'
import { UsersAdminPageComponent } from './users-admin-page.component'

const asAdmin = http.get('/api/auth/me', () => HttpResponse.json(adminProfile))
const withUsers = http.get('/api/admin/users', () =>
  HttpResponse.json([{ ...adminProfile, createdAt: '2025-12-01T00:00:00Z' }, adminUser]),
)

function renderUsers() {
  return renderWithProviders(UsersAdminPageComponent, { route: '/admin/users', path: '/admin/users' })
}

describe('UsersAdminPageComponent', () => {
  it('lists every user for a system admin', async () => {
    server.use(asAdmin, withUsers)

    await renderUsers()

    expect(await screen.findByRole('heading', { name: 'Users', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
    expect(screen.getByText('grace@example.com')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace (you)')).toBeInTheDocument()
  })

  it('does not offer to delete your own account', async () => {
    server.use(asAdmin, withUsers)

    await renderUsers()

    expect(await screen.findByRole('button', { name: 'Delete Grace Hopper' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Ada Lovelace' })).not.toBeInTheDocument()
  })

  it('shows the forbidden page to a regular user without calling the admin API', async () => {
    let requested = false
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(profile)),
      http.get('/api/admin/users', () => {
        requested = true
        return HttpResponse.json([])
      }),
    )

    await renderUsers()

    expect(await screen.findByText('Only system administrators can manage users.')).toBeInTheDocument()
    expect(requested).toBe(false)
  })

  it('shows the forbidden page when the API refuses', async () => {
    server.use(asAdmin, http.get('/api/admin/users', () => problem(403, 'Forbidden')))

    await renderUsers()

    expect(await screen.findByText('Only system administrators can manage users.')).toBeInTheDocument()
  })

  it('creates a user with the chosen role', async () => {
    let body: unknown
    server.use(
      asAdmin,
      withUsers,
      http.post('/api/admin/users', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(adminUser, { status: 201 })
      }),
    )

    const { user } = await renderUsers()

    await user.type(await screen.findByLabelText('Display name'), ' Grace Hopper ')
    await user.type(screen.getByLabelText('Email'), 'grace@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByLabelText('Role', { exact: true }))
    await user.click(await screen.findByRole('option', { name: 'Admin' }))
    await user.click(screen.getByRole('button', { name: 'Add user' }))

    expect(await screen.findByText('Grace Hopper added')).toBeInTheDocument()
    expect(body).toEqual({
      email: 'grace@example.com',
      displayName: 'Grace Hopper',
      password: 'password123',
      systemRole: 'ADMIN',
    })
  })

  it('validates the new user before calling the API', async () => {
    let posted = false
    server.use(
      asAdmin,
      withUsers,
      http.post('/api/admin/users', () => {
        posted = true
        return HttpResponse.json(adminUser, { status: 201 })
      }),
    )

    const { user } = await renderUsers()

    await user.type(await screen.findByLabelText('Display name'), 'Grace')
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Add user' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument()
    expect(posted).toBe(false)
  })

  it('edits a user and only sends a password when one is entered', async () => {
    let patched: unknown
    server.use(
      asAdmin,
      withUsers,
      http.patch('/api/admin/users/:userId', async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json({ ...adminUser, displayName: 'Rear Admiral Hopper' })
      }),
    )

    const { user } = await renderUsers()

    await user.click(await screen.findByRole('button', { name: 'Edit Grace Hopper' }))
    const dialog = await screen.findByRole('dialog')
    const name = within(dialog).getByLabelText('Display name')
    await user.clear(name)
    await user.type(name, 'Rear Admiral Hopper')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Rear Admiral Hopper updated')).toBeInTheDocument()
    expect(patched).toEqual({ displayName: 'Rear Admiral Hopper', email: 'grace@example.com', systemRole: 'USER' })
  })

  it('keeps the edit dialog open with the error when the update is refused', async () => {
    server.use(
      asAdmin,
      withUsers,
      http.patch('/api/admin/users/:userId', () => problem(409, 'Email is already registered')),
    )

    const { user } = await renderUsers()

    await user.click(await screen.findByRole('button', { name: 'Edit Grace Hopper' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByText('Email is already registered')).toBeInTheDocument()
  })

  it('deletes a user only after the confirmation dialog is accepted', async () => {
    let deleted = false
    server.use(
      asAdmin,
      withUsers,
      http.delete('/api/admin/users/:userId', () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const { user } = await renderUsers()

    await user.click(await screen.findByRole('button', { name: 'Delete Grace Hopper' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/Delete Grace Hopper\?/)).toBeInTheDocument()
    expect(deleted).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Grace Hopper deleted')).toBeInTheDocument()
    await waitFor(() => expect(deleted).toBe(true))
  })
})
