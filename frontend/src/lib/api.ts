export class ApiError extends Error {
  readonly status: number

  constructor(status: number, detail?: string) {
    super(detail ?? `Request failed (${status})`)
    this.status = status
  }
}

export function isForbidden(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403
}

export function csrfToken() {
  return document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))?.split('=')[1]
}

export async function request(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.method && options.method !== 'GET' ? { 'X-XSRF-TOKEN': csrfToken() ?? '' } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new ApiError(response.status, problem?.detail)
  }
  return response.status === 204 ? null : response.json()
}
