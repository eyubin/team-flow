import { createContext, useContext } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedAppearance = 'light' | 'dark'

export type ThemeContextValue = {
  preference: ThemePreference
  appearance: ResolvedAppearance
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useThemePreference() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useThemePreference must be used within a ThemeProvider')
  return context
}
