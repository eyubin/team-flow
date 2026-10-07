import { Component } from '@angular/core'
import { screen } from '@testing-library/angular'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/msw/server'
import { profile } from '../../test/msw/handlers'
import { RouterOutletHostComponent, renderWithProviders } from '../../test/render'
import { RequireAuthComponent } from './require-auth.component'

@Component({ selector: 'app-sign-in-stub', template: '<h1>Sign in page</h1>' })
class SignInStubComponent {}

@Component({ selector: 'app-secret-stub', template: '<h1>Secret dashboard</h1>' })
class SecretStubComponent {}

function renderGuardedRoute() {
  return renderWithProviders(RouterOutletHostComponent, {
    route: '/private',
    routes: [
      { path: '', pathMatch: 'full', component: SignInStubComponent },
      { path: '', component: RequireAuthComponent, children: [{ path: 'private', component: SecretStubComponent }] },
    ],
  })
}

describe('RequireAuthComponent', () => {
  it('renders the guarded route for a signed-in user', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(profile)))

    await renderGuardedRoute()

    expect(await screen.findByRole('heading', { name: 'Secret dashboard' })).toBeInTheDocument()
  })

  it('redirects to the sign-in page when there is no session', async () => {
    await renderGuardedRoute()

    expect(await screen.findByRole('heading', { name: 'Sign in page' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Secret dashboard' })).not.toBeInTheDocument()
  })

  it('announces that it is checking the session while the profile loads', async () => {
    await renderGuardedRoute()

    expect(await screen.findByText('Checking your session...')).toBeInTheDocument()
  })

  // A dropped request must not look like "signed out" - that would sign a valid
  // user straight back to the login page over a network blip.
  it('offers a retry instead of redirecting when the session check fails', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.error()))

    await renderGuardedRoute()

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't verify your session.")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sign in page' })).not.toBeInTheDocument()
  })

  // Only a 401 means signed out; a failing server must not end the session.
  it('offers a retry instead of redirecting when the session check errors', async () => {
    server.use(http.get('/api/auth/me', () => new HttpResponse(null, { status: 503 })))

    await renderGuardedRoute()

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't verify your session.")
    expect(screen.queryByRole('heading', { name: 'Sign in page' })).not.toBeInTheDocument()
  })
})
