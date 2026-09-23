import { describe, expect, it } from 'vitest'
import { accentTextColor, createAppTheme } from './muiTheme.ts'

describe('createAppTheme', () => {
  it('builds a light theme on the Radix iris and slate scales', () => {
    const theme = createAppTheme('light')

    expect(theme.palette.mode).toBe('light')
    expect(theme.palette.primary.main).toBe('#5b5bd6')
    expect(theme.palette.background.default).toBe('#fcfcfd')
    expect(theme.palette.background.paper).toBe('#f9f9fb')
    expect(theme.palette.text.primary).toBe('#1c2024')
  })

  it('builds a dark theme with the dark ends of the same scales', () => {
    const theme = createAppTheme('dark')

    expect(theme.palette.mode).toBe('dark')
    expect(theme.palette.background.default).toBe('#111113')
    expect(theme.palette.text.primary).toBe('#edeef0')
  })

  it('keeps the radius and type treatment the app already used', () => {
    const theme = createAppTheme('light')

    expect(theme.shape.borderRadius).toBe(8)
    expect(theme.typography.button.textTransform).toBe('none')
    // MUI's default stack leads with Roboto, a webfont this project does not
    // ship. The system stack must come first so nothing is requested.
    expect(theme.typography.fontFamily?.startsWith('-apple-system')).toBe(true)
  })
})

describe('accentTextColor', () => {
  it('gives a readable accent for each appearance', () => {
    expect(accentTextColor('light')).toBe('#5753c6')
    expect(accentTextColor('dark')).toBe('#b1a9ff')
  })
})
