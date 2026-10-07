import { Component } from '@angular/core'
import { screen } from '@testing-library/angular'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { AppShellComponent } from './app-shell.component'

@Component({
  imports: [AppShellComponent],
  template: '<app-shell><p>Page content</p></app-shell>',
})
class ShellHostComponent {}

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true })
}

// jsdom's window is shared across tests in a file, so a scroll position left
// behind by one test would otherwise become the next test's starting point.
beforeEach(() => {
  setScrollY(0)
})

async function scrollTo(fixture: { detectChanges: () => void }, y: number) {
  setScrollY(y)
  window.dispatchEvent(new Event('scroll'))
  fixture.detectChanges()
}

describe('AppShellComponent', () => {
  it('renders the brand, primary navigation and its content', async () => {
    await renderWithProviders(ShellHostComponent)

    expect(screen.getByRole('link', { name: 'TeamFlow' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Status' })).toHaveAttribute('href', '/status')
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('marks the current route as active', async () => {
    await renderWithProviders(ShellHostComponent, { route: '/dashboard' })

    expect(await screen.findByRole('link', { name: 'Dashboard', current: 'page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Status' })).not.toHaveAttribute('aria-current')
  })

  it('hides the header once the page is scrolled down past the threshold', async () => {
    const { container, fixture } = await renderWithProviders(ShellHostComponent)
    const header = container.querySelector('header')!
    expect(header).not.toHaveClass('app-header-hidden')

    await scrollTo(fixture, 300)

    expect(header).toHaveClass('app-header-hidden')
  })

  it('shows the header again when scrolling back up', async () => {
    const { container, fixture } = await renderWithProviders(ShellHostComponent)
    const header = container.querySelector('header')!

    await scrollTo(fixture, 300)
    expect(header).toHaveClass('app-header-hidden')

    await scrollTo(fixture, 120)
    expect(header).not.toHaveClass('app-header-hidden')
  })

  // Trackpad jitter must not flap the header, so movements under the
  // threshold are ignored entirely.
  it('ignores scroll movements below the jitter threshold', async () => {
    const { container, fixture } = await renderWithProviders(ShellHostComponent)
    const header = container.querySelector('header')!

    await scrollTo(fixture, 5)

    expect(header).not.toHaveClass('app-header-hidden')
  })
})
