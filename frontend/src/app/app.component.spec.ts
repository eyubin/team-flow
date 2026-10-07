import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from './test/msw/server.ts'
import { profile, workspace } from './test/msw/handlers.ts'
import { renderWithProviders } from './test/render.tsx'
import App from './App.tsx'

const signedIn = http.get('/api/auth/me', () => HttpResponse.json(profile))

describe('App routing', () => {
  it('shows the auth page at the root', async () => {
    renderWithProviders(<App />)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('serves the public status page without a session', async () => {
    renderWithProviders(<App />, { route: '/status' })

    expect(await screen.findByText('API is UP')).toBeInTheDocument()
  })

  it('renders the not-found page for an unknown route', async () => {
    renderWithProviders(<App />, { route: '/nowhere' })

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
  })

  it('redirects /auth to the root', async () => {
    renderWithProviders(<App />, { route: '/auth' })

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('guards the dashboard behind a session', async () => {
    renderWithProviders(<App />, { route: '/dashboard' })

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('lets a signed-in user reach the dashboard', async () => {
    server.use(signedIn, http.get('/api/workspaces', () => HttpResponse.json([workspace])))

    renderWithProviders(<App />, { route: '/dashboard' })

    expect(await screen.findByRole('heading', { name: 'Project dashboard' })).toBeInTheDocument()
  })

  // A session that expires while the user is already inside the app should
  // land them back on the auth page rather than on a broken screen.
  it('sends the user home when a request reports the session has expired', async () => {
    server.use(
      signedIn,
      http.get('/api/workspaces', () => new HttpResponse(null, { status: 401 })),
    )

    renderWithProviders(<App />, { route: '/dashboard' })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument())
  })

  // Signing out or deleting the account in one tab expires the cookies for
  // all of them, so the others must stop showing the signed-in UI too.
  it('signs out when another tab reports the session has ended', async () => {
    server.use(signedIn, http.get('/api/workspaces', () => HttpResponse.json([workspace])))

    renderWithProviders(<App />, { route: '/dashboard' })
    expect(await screen.findByRole('heading', { name: 'Project dashboard' })).toBeInTheDocument()

    server.use(http.get('/api/auth/me', () => new HttpResponse(null, { status: 401 })))
    const otherTab = new BroadcastChannel('teamflow-auth')
    otherTab.postMessage('signed-out')
    otherTab.close()

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
})
