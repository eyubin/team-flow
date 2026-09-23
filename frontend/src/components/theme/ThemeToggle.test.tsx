import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from './ThemeProvider.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'

function renderToggle() {
  const user = userEvent.setup()
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
  return { user }
}

describe('ThemeToggle', () => {
  it('exposes a labelled control for changing the theme', () => {
    renderToggle()

    expect(screen.getByRole('button', { name: 'Change theme' })).toBeInTheDocument()
  })

  it('offers light, dark and system choices', async () => {
    const { user } = renderToggle()

    await user.click(screen.getByRole('button', { name: 'Change theme' }))

    expect(await screen.findByRole('menuitem', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'System' })).toBeInTheDocument()
  })

  it('stores the chosen preference', async () => {
    const { user } = renderToggle()

    await user.click(screen.getByRole('button', { name: 'Change theme' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Dark' }))

    expect(window.localStorage.getItem('teamflow-theme')).toBe('dark')
  })
})
