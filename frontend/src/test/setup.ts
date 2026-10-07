import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw/server'

// jsdom ships no matchMedia, which ThemeService reads on creation. Default to
// "light"; tests that care about the system preference stub it themselves.
if (!window.matchMedia) {
  window.matchMedia = () =>
    ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList
}

// `error` rather than `warn`: an unhandled request means a test is exercising an
// endpoint nobody has described, which is worth failing on rather than silently
// hanging until the assertion times out.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// TestBed tears down every rendered fixture after each test on its own.
afterEach(() => {
  server.resetHandlers()
  window.localStorage.clear()
})

afterAll(() => server.close())
