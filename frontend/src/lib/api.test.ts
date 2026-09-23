import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw/server.ts'
import { ApiError, csrfToken, isForbidden, onUnauthorized, request } from './api.ts'

afterEach(() => {
  onUnauthorized(null)
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('request', () => {
  it('returns the parsed body of a successful response', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ displayName: 'Ada' })))

    await expect(request('/api/auth/me')).resolves.toEqual({ displayName: 'Ada' })
  })

  it('returns null for 204 responses rather than trying to parse a body', async () => {
    await expect(request('/api/auth/csrf')).resolves.toBeNull()
  })

  it('throws an ApiError carrying the problem detail', async () => {
    server.use(http.get('/api/workspaces', () => HttpResponse.json({ detail: 'Not a member' }, { status: 403 })))

    await expect(request('/api/workspaces')).rejects.toMatchObject({ status: 403, message: 'Not a member' })
  })

  it('falls back to a generic message when the error body is not a problem document', async () => {
    server.use(http.get('/api/workspaces', () => new HttpResponse('nope', { status: 500 })))

    await expect(request('/api/workspaces')).rejects.toMatchObject({ status: 500, message: 'Request failed (500)' })
  })

  it('sends the CSRF token from the cookie on mutating requests', async () => {
    document.cookie = 'XSRF-TOKEN=token-123'
    let headers: Headers | undefined
    server.use(
      http.post('/api/workspaces', ({ request: received }) => {
        headers = received.headers
        return HttpResponse.json({}, { status: 201 })
      }),
    )

    await request('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: 'Acme' }) })

    expect(headers?.get('X-XSRF-TOKEN')).toBe('token-123')
    expect(headers?.get('Content-Type')).toBe('application/json')
  })

  it('does not send a CSRF token on reads', async () => {
    document.cookie = 'XSRF-TOKEN=token-123'
    let headers: Headers | undefined
    server.use(
      http.get('/api/workspaces', ({ request: received }) => {
        headers = received.headers
        return HttpResponse.json([])
      }),
    )

    await request('/api/workspaces')

    expect(headers?.get('X-XSRF-TOKEN')).toBeNull()
  })

  it('notifies the unauthorized handler when the session has expired', async () => {
    const handler = vi.fn()
    onUnauthorized(handler)
    server.use(http.get('/api/workspaces', () => new HttpResponse(null, { status: 401 })))

    await expect(request('/api/workspaces')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('stops notifying once the handler is cleared', async () => {
    const handler = vi.fn()
    onUnauthorized(handler)
    onUnauthorized(null)
    server.use(http.get('/api/workspaces', () => new HttpResponse(null, { status: 401 })))

    await expect(request('/api/workspaces')).rejects.toBeInstanceOf(ApiError)
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('csrfToken', () => {
  it('reads the token out of a cookie jar with other entries', () => {
    document.cookie = 'other=value'
    document.cookie = 'XSRF-TOKEN=token-456'

    expect(csrfToken()).toBe('token-456')
  })
})

describe('isForbidden', () => {
  it('recognises only a 403 ApiError', () => {
    expect(isForbidden(new ApiError(403))).toBe(true)
    expect(isForbidden(new ApiError(401))).toBe(false)
    expect(isForbidden(new Error('nope'))).toBe(false)
  })
})
