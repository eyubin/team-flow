import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from './ThemeProvider.tsx'
import { useThemePreference } from './theme-context.ts'

type MediaListener = (event: MediaQueryListEvent) => void

/** jsdom has no matchMedia, so drive the system preference by hand. */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<MediaListener>()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: prefersDark,
      addEventListener: (_: string, listener: MediaListener) => listeners.add(listener),
      removeEventListener: (_: string, listener: MediaListener) => listeners.delete(listener),
    })),
  )
  return listeners
}

function Probe() {
  const { preference, appearance, setPreference } = useThemePreference()
  return (
    <div>
      <p data-testid="preference">{preference}</p>
      <p data-testid="appearance">{appearance}</p>
      <button type="button" onClick={() => setPreference('dark')}>
        Go dark
      </button>
      <button type="button" onClick={() => setPreference('system')}>
        Follow system
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  stubMatchMedia(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ThemeProvider', () => {
  it('defaults to following the system preference', () => {
    renderProbe()

    expect(screen.getByTestId('preference')).toHaveTextContent('system')
    expect(screen.getByTestId('appearance')).toHaveTextContent('light')
  })

  it('resolves a dark appearance when the system prefers dark', () => {
    stubMatchMedia(true)

    renderProbe()

    expect(screen.getByTestId('appearance')).toHaveTextContent('dark')
  })

  it('persists an explicit preference and applies it over the system setting', async () => {
    const user = userEvent.setup()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'Go dark' }))

    expect(screen.getByTestId('preference')).toHaveTextContent('dark')
    expect(screen.getByTestId('appearance')).toHaveTextContent('dark')
    expect(window.localStorage.getItem('teamflow-theme')).toBe('dark')
  })

  it('restores a stored preference on mount', () => {
    window.localStorage.setItem('teamflow-theme', 'dark')

    renderProbe()

    expect(screen.getByTestId('preference')).toHaveTextContent('dark')
  })

  it('ignores a stored value that is not a known preference', () => {
    window.localStorage.setItem('teamflow-theme', 'neon')

    renderProbe()

    expect(screen.getByTestId('preference')).toHaveTextContent('system')
  })

  it('follows later system changes while the preference is "system"', async () => {
    const listeners = stubMatchMedia(false)
    renderProbe()

    expect(screen.getByTestId('appearance')).toHaveTextContent('light')

    await act(async () => {
      listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent))
    })

    expect(screen.getByTestId('appearance')).toHaveTextContent('dark')
  })
})

describe('useThemePreference', () => {
  it('fails loudly when used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow('useThemePreference must be used within a ThemeProvider')

    consoleError.mockRestore()
  })
})
