import { useEffect, useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

type HealthState = 'loading' | 'ok' | 'error'

type HealthBody = {
  status?: string
}

const BADGE_BY_STATE: Record<HealthState, { color: 'default' | 'success' | 'error'; label: string }> = {
  loading: { color: 'default', label: 'Checking' },
  ok: { color: 'success', label: 'Healthy' },
  error: { color: 'error', label: 'Unavailable' },
}

export function HealthStatus() {
  const [state, setState] = useState<HealthState>('loading')
  const [message, setMessage] = useState('Checking API…')

  useEffect(() => {
    const controller = new AbortController()

    fetch('/actuator/health', { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Health check failed (${response.status})`)
        }
        return (await response.json()) as HealthBody
      })
      .then((body) => {
        if (body.status === 'UP') {
          setState('ok')
          setMessage('API is UP')
          return
        }
        setState('error')
        setMessage(`API reported ${body.status ?? 'an unknown status'}`)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setState('error')
        setMessage(error instanceof Error ? error.message : 'API is unreachable')
      })

    return () => controller.abort()
  }, [])

  const badge = BADGE_BY_STATE[state]

  return (
    <Card component="section" aria-live="polite">
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" component="h2">
            API health
          </Typography>
          <Chip color={badge.color} label={badge.label} size="small" variant="outlined" />
        </Stack>
        <Typography component="p" color="text.secondary">
          {state === 'loading' ? 'Loading' : message}
        </Typography>
      </CardContent>
    </Card>
  )
}
