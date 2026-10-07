import { screen } from '@testing-library/angular'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { StatusPageComponent } from './status-page.component'

describe('StatusPageComponent', () => {
  it('renders the API health card', async () => {
    await renderWithProviders(StatusPageComponent)

    expect(screen.getByRole('heading', { name: 'TeamFlow', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('API is UP')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open account flow' })).toHaveAttribute('href', '/')
  })
})
