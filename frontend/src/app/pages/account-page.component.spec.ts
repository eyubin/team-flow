import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { server } from '../test/msw/server.ts'
import { problem, profile } from '../test/msw/handlers.ts'
import { renderWithProviders } from '../test/render.tsx'
import { RequireAuth } from '../components/RequireAuth.tsx'
import { AccountPage } from './AccountPage.tsx'

const signedIn = http.get('/api/auth/me', () => HttpResponse.json(profile))

// Mounted behind RequireAuth, as in App, so the page gets a loaded profile and
// a successful deletion has somewhere to land.
function renderAccount() {
  return renderWithProviders(
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/account" element={<AccountPage />} />
      </Route>
      <Route path="/" element={<p>Signed-out landing</p>} />
    </Routes>,
    { route: '/account' },
  )
}

function section(name: string) {
  return screen.getByRole('region', { name })
}

describe('AccountPage', () => {
  it('shows the current profile', async () => {
    server.use(signedIn)

    renderAccount()

    expect(await screen.findByRole('heading', { name: 'Account settings' })).toBeInTheDocument()
    expect(within(section('Profile')).getByLabelText('Display name')).toHaveValue('Ada Lovelace')
    expect(within(section('Profile')).getByLabelText('Email')).toHaveValue('ada@example.com')
  })

  it('renames the user without asking for a password', async () => {
    let body: unknown
    server.use(
      signedIn,
      http.patch('/api/users/me', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...profile, displayName: 'Ada King' })
      }),
    )

    const { user } = renderAccount()

    const displayName = await screen.findByLabelText('Display name')
    await user.clear(displayName)
    await user.type(displayName, 'Ada King')
    expect(within(section('Profile')).queryByLabelText('Current password')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Profile updated')).toBeInTheDocument()
    expect(body).toEqual({ displayName: 'Ada King', email: 'ada@example.com' })
    expect(displayName).toHaveValue('Ada King')
  })

  it('requires the current password before changing the email', async () => {
    let body: unknown
    server.use(
      signedIn,
      http.patch('/api/users/me', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...profile, email: 'ada@analytical.org' })
      }),
    )

    const { user } = renderAccount()

    const email = await screen.findByLabelText('Email')
    await user.clear(email)
    await user.type(email, 'ada@analytical.org')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await within(section('Profile')).findByRole('alert')).toHaveTextContent(
      'Enter your current password to change your email',
    )
    expect(body).toBeUndefined()

    await user.type(within(section('Profile')).getByLabelText('Current password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Profile updated')).toBeInTheDocument()
    expect(body).toEqual({ displayName: 'Ada Lovelace', email: 'ada@analytical.org', currentPassword: 'password123' })
  })

  it('shows the API error when the profile update is rejected', async () => {
    server.use(signedIn, http.patch('/api/users/me', () => problem(409, 'Email is already registered')))

    const { user } = renderAccount()

    const email = await screen.findByLabelText('Email')
    await user.clear(email)
    await user.type(email, 'grace@example.com')
    await user.type(within(section('Profile')).getByLabelText('Current password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Email is already registered')).toBeInTheDocument()
  })

  it('rejects a mismatched confirmation before calling the API', async () => {
    let called = false
    server.use(
      signedIn,
      http.put('/api/users/me/password', () => {
        called = true
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const { user } = renderAccount()

    const passwords = within(await screen.findByRole('region', { name: 'Password' }))
    await user.type(passwords.getByLabelText('Current password'), 'password123')
    await user.type(passwords.getByLabelText('New password'), 'new-password-456')
    await user.type(passwords.getByLabelText('Confirm new password'), 'something-else')
    await user.click(passwords.getByRole('button', { name: 'Change password' }))

    expect(await passwords.findByRole('alert')).toHaveTextContent('Passwords do not match')
    expect(called).toBe(false)
  })

  it('changes the password and clears the form', async () => {
    let body: unknown
    server.use(
      signedIn,
      http.put('/api/users/me/password', async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const { user } = renderAccount()

    const passwords = within(await screen.findByRole('region', { name: 'Password' }))
    await user.type(passwords.getByLabelText('Current password'), 'password123')
    await user.type(passwords.getByLabelText('New password'), 'new-password-456')
    await user.type(passwords.getByLabelText('Confirm new password'), 'new-password-456')
    await user.click(passwords.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('Password changed')).toBeInTheDocument()
    expect(body).toEqual({ currentPassword: 'password123', newPassword: 'new-password-456' })
    expect(passwords.getByLabelText('New password')).toHaveValue('')
  })

  it('deletes the account only after the password is confirmed, then signs out everywhere', async () => {
    const otherTab = new BroadcastChannel('teamflow-auth')
    const broadcasts: unknown[] = []
    otherTab.onmessage = (event: MessageEvent) => broadcasts.push(event.data)
    let body: unknown
    server.use(
      signedIn,
      http.delete('/api/users/me', async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const { user } = renderAccount()

    await user.click(await within(await screen.findByRole('region', { name: 'Delete account' })).findByRole('button', { name: 'Delete account' }))

    const dialog = await screen.findByRole('alertdialog')
    const confirm = within(dialog).getByRole('button', { name: 'Delete account' })
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByLabelText('Password'), 'password123')
    await user.click(confirm)

    expect(await screen.findByText('Signed-out landing')).toBeInTheDocument()
    expect(body).toEqual({ password: 'password123' })
    await waitFor(() => expect(broadcasts).toEqual(['signed-out']))
    otherTab.close()
  })

  it('keeps the dialog open and explains why when deletion is refused', async () => {
    server.use(
      signedIn,
      http.delete('/api/users/me', () =>
        problem(409, 'Make someone else an administrator of Acme before deleting your account'),
      ),
    )

    const { user } = renderAccount()

    await user.click(await within(await screen.findByRole('region', { name: 'Delete account' })).findByRole('button', { name: 'Delete account' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.type(within(dialog).getByLabelText('Password'), 'password123')
    await user.click(within(dialog).getByRole('button', { name: 'Delete account' }))

    expect(await within(dialog).findByText(/administrator of Acme/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Signed-out landing')).not.toBeInTheDocument())
  })
})
