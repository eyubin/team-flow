import { useEffect, useState } from 'react'

type HealthState = 'loading' | 'ok' | 'error'

type HealthBody = {
  status?: string
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

  return (
    <section aria-live="polite" className={`health health-${state}`}>
      <h2>API health</h2>
      <p>{state === 'loading' ? 'Loading' : message}</p>
    </section>
  )
}
