import { createTheme, type Theme } from '@mui/material/styles'
import type { ResolvedAppearance } from '../components/theme/theme-context.ts'

/**
 * Colour values lifted from the Radix Themes scales the app was built on
 * (accent `iris`, gray `slate`), so the MUI rebuild keeps the look the
 * product already had rather than landing on MUI's default blue.
 */
const IRIS = {
  light: { solid: '#5b5bd6', hover: '#5151cd', text: '#5753c6', subtle: '#f0f1fe' },
  dark: { solid: '#5b5bd6', hover: '#6e6ade', text: '#b1a9ff', subtle: '#202248' },
}

const SLATE = {
  light: { app: '#fcfcfd', panel: '#f9f9fb', muted: '#60646c', strong: '#1c2024', divider: '#0000001f' },
  dark: { app: '#111113', panel: '#18191b', muted: '#b0b4ba', strong: '#edeef0', divider: '#ffffff22' },
}

// Radix Themes' own stack. Keeping it avoids pulling in Roboto - MUI's default
// font, which this project has never shipped - and avoids a webfont request.
const FONT_FAMILY = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'system-ui',
  'sans-serif',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
].join(', ')

export function createAppTheme(appearance: ResolvedAppearance): Theme {
  const iris = IRIS[appearance]
  const slate = SLATE[appearance]

  return createTheme({
    palette: {
      mode: appearance,
      primary: { main: iris.solid, dark: iris.hover, light: iris.subtle, contrastText: '#ffffff' },
      background: { default: slate.app, paper: slate.panel },
      text: { primary: slate.strong, secondary: slate.muted },
      divider: slate.divider,
    },
    shape: {
      // Matches Radix `radius="large"`, which the app set explicitly.
      borderRadius: 8,
    },
    typography: {
      fontFamily: FONT_FAMILY,
      button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
      MuiCard: { defaultProps: { variant: 'outlined' } },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          // Submit buttons sit beside inputs in flex rows; keep their label on
          // one line instead of letting the row squeeze it into a wrap.
          root: { '&[type="submit"]': { whiteSpace: 'nowrap', flexShrink: 0 } },
        },
      },
    },
  })
}

/** The accent used for links and active navigation, per appearance. */
export function accentTextColor(appearance: ResolvedAppearance) {
  return IRIS[appearance].text
}
