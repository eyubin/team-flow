import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/render.tsx'
import { StatusPage } from './StatusPage.tsx'

describe('StatusPage', () => {
  it('renders the API health card', async () => {
    renderWithProviders(<StatusPage />)

    expect(screen.getByRole('heading', { name: 'TeamFlow', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('API is UP')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open account flow' })).toHaveAttribute('href', '/')
  })
})
