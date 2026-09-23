import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw/server.ts'

// jsdom ships no matchMedia, which ThemeProvider reads on mount. Default to
// "light"; tests that care about the system preference stub it themselves.
if (!window.matchMedia) {
  window.matchMedia = () =>
    ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList
}

// `error` rather than `warn`: an unhandled request means a test is exercising an
// endpoint nobody has described, which is worth failing on rather than silently
// hanging until the assertion times out.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  cleanup()
  server.resetHandlers()
  window.localStorage.clear()
})

afterAll(() => server.close())
