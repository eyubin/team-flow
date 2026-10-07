import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { server } from '../test/msw/server.ts'
import { profile } from '../test/msw/handlers.ts'
import { renderWithProviders } from '../test/render.tsx'
import { RequireAuth } from './RequireAuth.tsx'

function renderGuardedRoute() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<h1>Sign in page</h1>} />
      <Route element={<RequireAuth />}>
        <Route path="/private" element={<h1>Secret dashboard</h1>} />
      </Route>
    </Routes>,
    { route: '/private' },
  )
}

describe('RequireAuth', () => {
  it('renders the guarded route for a signed-in user', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(profile)))

    renderGuardedRoute()

    expect(await screen.findByRole('heading', { name: 'Secret dashboard' })).toBeInTheDocument()
  })

  it('redirects to the sign-in page when there is no session', async () => {
    renderGuardedRoute()

    expect(await screen.findByRole('heading', { name: 'Sign in page' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Secret dashboard' })).not.toBeInTheDocument()
  })

  it('announces that it is checking the session while the profile loads', () => {
    renderGuardedRoute()

    expect(screen.getByText('Checking your session...')).toBeInTheDocument()
  })

  // A dropped request must not look like "signed out" - that would sign a valid
  // user straight back to the login page over a network blip.
  it('offers a retry instead of redirecting when the session check fails', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.error()))

    renderGuardedRoute()

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't verify your session.")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sign in page' })).not.toBeInTheDocument()
  })

  // Only a 401 means signed out; a failing server must not end the session.
  it('offers a retry instead of redirecting when the session check errors', async () => {
    server.use(http.get('/api/auth/me', () => new HttpResponse(null, { status: 503 })))

    renderGuardedRoute()

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't verify your session.")
    expect(screen.queryByRole('heading', { name: 'Sign in page' })).not.toBeInTheDocument()
  })
})
