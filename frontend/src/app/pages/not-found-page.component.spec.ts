import { screen } from '@testing-library/angular'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { NotFoundPageComponent } from './not-found-page.component'

describe('NotFoundPageComponent', () => {
  it('explains the page is missing and offers a way home', async () => {
    await renderWithProviders(NotFoundPageComponent)

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
    expect(document.title).toContain('Page not found')
  })
})
