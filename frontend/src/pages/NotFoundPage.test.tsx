import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/render.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'

describe('NotFoundPage', () => {
  it('explains the page is missing and offers a way home', () => {
    renderWithProviders(<NotFoundPage />)

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
    expect(document.title).toContain('Page not found')
  })
})
