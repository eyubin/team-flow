import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { createTestQueryClient } from '../test/queryClient.ts'
import { AuthPage } from './AuthPage.tsx'

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

function renderAuthPage() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={createTestQueryClient()}>
        <AuthPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AuthPage', () => {
  it('shows the login form when no session exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, false, 401)))

    renderAuthPage()

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('registers through the CSRF-protected API and shows the profile', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({}, false, 401))
      .mockResolvedValueOnce(response({}, true, 204))
      .mockResolvedValueOnce(response({ email: 'new@example.com', displayName: 'New User' }, true, 201))
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'XSRF-TOKEN=csrf-value'

    renderAuthPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Need an account?' }))
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New User' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Register' }).closest('form')!)

    expect(await screen.findByText('Welcome, New User')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-value' },
    })
  })
})
