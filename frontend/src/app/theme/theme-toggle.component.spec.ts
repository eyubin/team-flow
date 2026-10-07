import { screen } from '@testing-library/angular'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { ThemeToggleComponent } from './theme-toggle.component'

describe('ThemeToggleComponent', () => {
  it('exposes a labelled control for changing the theme', async () => {
    await renderWithProviders(ThemeToggleComponent)

    expect(screen.getByRole('button', { name: 'Change theme' })).toBeInTheDocument()
  })

  it('offers light, dark and system choices', async () => {
    const { user } = await renderWithProviders(ThemeToggleComponent)

    await user.click(screen.getByRole('button', { name: 'Change theme' }))

    expect(await screen.findByRole('menuitem', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'System' })).toBeInTheDocument()
  })

  it('stores the chosen preference', async () => {
    const { user } = await renderWithProviders(ThemeToggleComponent)

    await user.click(screen.getByRole('button', { name: 'Change theme' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Dark' }))

    expect(window.localStorage.getItem('teamflow-theme')).toBe('dark')
  })
})
