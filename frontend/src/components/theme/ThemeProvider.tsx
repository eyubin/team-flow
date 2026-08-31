import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Theme } from '@radix-ui/themes'
import { ThemeContext } from './theme-context.ts'
import type { ThemePreference } from './theme-context.ts'

const STORAGE_KEY = 'teamflow-theme'

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const appearance = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  const value = useMemo(() => ({ preference, appearance, setPreference }), [preference, appearance, setPreference])

  return (
    <ThemeContext.Provider value={value}>
      <Theme accentColor="iris" grayColor="slate" radius="large" appearance={appearance} panelBackground="solid">
        {children}
      </Theme>
    </ThemeContext.Provider>
  )
}
