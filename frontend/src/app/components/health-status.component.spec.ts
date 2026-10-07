import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw/server.ts'
import { HealthStatus } from '../components/HealthStatus.tsx'

describe('HealthStatus', () => {
  it('shows an UP state when the API is healthy', async () => {
    render(<HealthStatus />)

    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(await screen.findByText('API is UP')).toBeInTheDocument()
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('reports the status the API gave when it is not UP', async () => {
    server.use(http.get('/actuator/health', () => HttpResponse.json({ status: 'DOWN' })))

    render(<HealthStatus />)

    expect(await screen.findByText('API reported DOWN')).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('shows an error state when the health endpoint fails', async () => {
    server.use(http.get('/actuator/health', () => new HttpResponse(null, { status: 503 })))

    render(<HealthStatus />)

    expect(await screen.findByText('Health check failed (503)')).toBeInTheDocument()
  })
})
