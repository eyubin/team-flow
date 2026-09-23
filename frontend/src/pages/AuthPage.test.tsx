import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw/server.ts'
import { profile } from '../test/msw/handlers.ts'
import { renderWithProviders } from '../test/render.tsx'
import { AuthPage } from './AuthPage.tsx'

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=csrf-value'
})

describe('AuthPage', () => {
  it('shows the login form when no session exists', async () => {
    renderWithProviders(<AuthPage />)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('registers through the CSRF-protected API and shows the profile', async () => {
    let registerHeaders: Headers | undefined
    server.use(
      http.post('/api/auth/register', ({ request }) => {
        registerHeaders = request.headers
        return HttpResponse.json({ ...profile, email: 'new@example.com', displayName: 'New User' }, { status: 201 })
      }),
    )

    const { user } = renderWithProviders(<AuthPage />)

    await user.click(await screen.findByRole('button', { name: 'Need an account?' }))
    await user.type(screen.getByLabelText('Display name'), 'New User')
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(await screen.findByText('Welcome, New User')).toBeInTheDocument()
    await waitFor(() => expect(registerHeaders).toBeDefined())
    expect(registerHeaders?.get('X-XSRF-TOKEN')).toBe('csrf-value')
    expect(registerHeaders?.get('Content-Type')).toBe('application/json')
  })

  it('reports an error when the credentials are rejected', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.json({ detail: 'Invalid email or password' }, { status: 401 })))

    const { user } = renderWithProviders(<AuthPage />)

    await user.type(await screen.findByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })
})
