import { act, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render.tsx'
import { AppShell } from './AppShell.tsx'

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true })
}

// jsdom's window is shared across tests in a file, so a scroll position left
// behind by one test would otherwise become the next test's starting point.
beforeEach(() => {
  setScrollY(0)
})

function scrollTo(y: number) {
  setScrollY(y)
  act(() => {
    window.dispatchEvent(new Event('scroll'))
  })
}

describe('AppShell', () => {
  it('renders the brand, primary navigation and its children', () => {
    renderWithProviders(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    )

    expect(screen.getByRole('link', { name: 'TeamFlow' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Status' })).toHaveAttribute('href', '/status')
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('marks the current route as active', () => {
    renderWithProviders(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
      { route: '/dashboard' },
    )

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('nav-link-active')
    expect(screen.getByRole('link', { name: 'Status' })).not.toHaveClass('nav-link-active')
  })

  it('hides the header once the page is scrolled down past the threshold', () => {
    const { container } = renderWithProviders(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    )
    const header = container.querySelector('header')!
    expect(header).not.toHaveClass('app-header-hidden')

    scrollTo(300)

    expect(header).toHaveClass('app-header-hidden')
  })

  it('shows the header again when scrolling back up', () => {
    const { container } = renderWithProviders(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    )
    const header = container.querySelector('header')!

    scrollTo(300)
    expect(header).toHaveClass('app-header-hidden')

    scrollTo(120)
    expect(header).not.toHaveClass('app-header-hidden')
  })

  // Trackpad jitter must not flap the header, so movements under the
  // threshold are ignored entirely.
  it('ignores scroll movements below the jitter threshold', () => {
    const { container } = renderWithProviders(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    )
    const header = container.querySelector('header')!

    scrollTo(5)

    expect(header).not.toHaveClass('app-header-hidden')
  })
})
