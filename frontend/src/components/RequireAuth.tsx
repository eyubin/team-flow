import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Box, Text } from '@radix-ui/themes'
import { useProfile } from '../lib/auth.ts'

export function RequireAuth() {
  const location = useLocation()
  const profileQuery = useProfile()

  if (profileQuery.isLoading) {
    return (
      <Box asChild>
        <main>
          <Text aria-live="polite">Checking your session...</Text>
        </main>
      </Box>
    )
  }

  if (!profileQuery.data) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return <Outlet />
}
