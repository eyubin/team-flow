import { Navigate, Outlet, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useProfile } from '../lib/auth.ts'
import { QueryError } from './QueryError.tsx'

export function RequireAuth() {
  const location = useLocation()
  const profileQuery = useProfile()

  if (profileQuery.isLoading) {
    return (
      <Box component="main">
        <Typography aria-live="polite">Checking your session...</Typography>
      </Box>
    )
  }

  // A network failure here is not the same as "not signed in" - redirecting
  // to the login page would sign out a legitimately authenticated user just
  // because a request dropped. Offer a retry instead.
  if (profileQuery.isError) {
    return (
      <Box component="main">
        <QueryError
          message="We couldn't verify your session. Check your connection and try again."
          onRetry={() => void profileQuery.refetch()}
        />
      </Box>
    )
  }

  if (!profileQuery.data) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return <Outlet />
}
