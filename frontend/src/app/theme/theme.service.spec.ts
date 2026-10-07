import { TestBed } from '@angular/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeService } from './theme.service'

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

function createService() {
  const service = TestBed.inject(ThemeService)
  TestBed.tick()
  return service
}

beforeEach(() => {
  stubMatchMedia(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
  delete document.documentElement.dataset['appearance']
})

describe('ThemeService', () => {
  it('defaults to following the system preference', () => {
    const service = createService()

    expect(service.preference()).toBe('system')
    expect(service.appearance()).toBe('light')
  })

  it('applies the resolved appearance to the root element for the Material theme', () => {
    const service = createService()

    expect(document.documentElement.style.colorScheme).toBe('light')

    service.setPreference('dark')
    TestBed.tick()

    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.documentElement.dataset['appearance']).toBe('dark')
  })

  it('resolves a dark appearance when the system prefers dark', () => {
    stubMatchMedia(true)

    expect(createService().appearance()).toBe('dark')
  })

  it('persists an explicit preference and applies it over the system setting', () => {
    const service = createService()

    service.setPreference('dark')

    expect(service.preference()).toBe('dark')
    expect(service.appearance()).toBe('dark')
    expect(window.localStorage.getItem('teamflow-theme')).toBe('dark')
  })

  it('restores a stored preference', () => {
    window.localStorage.setItem('teamflow-theme', 'dark')

    expect(createService().preference()).toBe('dark')
  })

  it('ignores a stored value that is not a known preference', () => {
    window.localStorage.setItem('teamflow-theme', 'neon')

    expect(createService().preference()).toBe('system')
  })

  it('follows later system changes while the preference is "system"', () => {
    const listeners = stubMatchMedia(false)
    const service = createService()

    expect(service.appearance()).toBe('light')

    listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent))

    expect(service.appearance()).toBe('dark')
  })
})
