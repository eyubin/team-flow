import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HealthStatus } from '../components/HealthStatus.tsx'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HealthStatus', () => {
  it('shows an UP state when the API is healthy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'UP' }),
      }),
    )

    render(<HealthStatus />)
    expect(screen.getByText('Loading')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('API is UP')).toBeInTheDocument()
    })
  })

  it('shows an error state when the API is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    )

    render(<HealthStatus />)
    await waitFor(() => {
      expect(screen.getByText('Health check failed (503)')).toBeInTheDocument()
    })
  })
})
