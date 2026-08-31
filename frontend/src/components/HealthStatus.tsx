import { useEffect, useState } from 'react'
import { Badge, Card, Flex, Heading, Text } from '@radix-ui/themes'

type HealthState = 'loading' | 'ok' | 'error'

type HealthBody = {
  status?: string
}

const BADGE_BY_STATE: Record<HealthState, { color: 'gray' | 'green' | 'red'; label: string }> = {
  loading: { color: 'gray', label: 'Checking' },
  ok: { color: 'green', label: 'Healthy' },
  error: { color: 'red', label: 'Unavailable' },
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
    <Card asChild variant="surface">
      <section aria-live="polite">
        <Flex align="center" justify="between" gap="3" mb="2">
          <Heading as="h2" size="4">
            API health
          </Heading>
          <Badge color={badge.color} variant="soft">
            {badge.label}
          </Badge>
        </Flex>
        <Text as="p" color="gray">
          {state === 'loading' ? 'Loading' : message}
        </Text>
      </section>
    </Card>
  )
}
