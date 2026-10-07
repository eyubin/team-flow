import { DOCUMENT } from '@angular/common'
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedAppearance = 'light' | 'dark'

const STORAGE_KEY = 'teamflow-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStoredPreference(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

/**
 * Owns the light/dark choice. The Material theme in styles.scss is built on
 * `light-dark()`, so applying an appearance is just setting `color-scheme` on
 * the root element: every Material token, and every Tailwind colour that
 * reads one, follows without a second copy of the palette.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT)
  private readonly systemDark = signal(window.matchMedia(DARK_QUERY).matches)

  readonly preference = signal<ThemePreference>(readStoredPreference())
  readonly appearance = computed<ResolvedAppearance>(() => {
    const preference = this.preference()
    if (preference !== 'system') return preference
    return this.systemDark() ? 'dark' : 'light'
  })

  constructor() {
    const media = window.matchMedia(DARK_QUERY)
    const listener = (event: MediaQueryListEvent) => this.systemDark.set(event.matches)
    media.addEventListener('change', listener)
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', listener))

    effect(() => {
      const root = this.document.documentElement
      root.style.colorScheme = this.appearance()
      root.dataset['appearance'] = this.appearance()
    })
  }

  setPreference(preference: ThemePreference) {
    this.preference.set(preference)
    window.localStorage.setItem(STORAGE_KEY, preference)
  }
}
