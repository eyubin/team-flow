import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../components/theme/ThemeProvider.tsx'
import { createTestQueryClient } from './queryClient.ts'

type RenderOptions = {
  /** Initial history entry, e.g. '/projects/project-1/tasks'. */
  route?: string
  /** Route pattern to mount `ui` under, when the component reads URL params. */
  path?: string
}

/**
 * Single place that knows which providers the app needs, so a test states what
 * it is testing and nothing else - and so swapping the design system's provider
 * is a one-line change here rather than an edit to every test file.
 */
export function renderWithProviders(ui: ReactElement, { route = '/', path }: RenderOptions = {}) {
  const user = userEvent.setup()
  const result = render(
    <ThemeProvider>
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={[route]}>
          {path ? (
            <Routes>
              <Route path={path} element={ui} />
            </Routes>
          ) : (
            ui
          )}
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )

  return { user, ...result }
}
