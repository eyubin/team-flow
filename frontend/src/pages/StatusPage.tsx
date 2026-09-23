import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { HealthStatus } from '../components/HealthStatus.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

export function StatusPage() {
  useDocumentTitle('Status')
  return (
    <Box component="main" sx={{ maxWidth: '34rem' }}>
      <Stack spacing={2}>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
          TeamFlow
        </Typography>
        <Typography component="p" color="text.secondary">
          Local skeleton is up when the API health check below reports{' '}
          <Typography component="span" sx={{ fontWeight: 700 }}>
            UP
          </Typography>
          .
        </Typography>
        <HealthStatus />
        <Typography component="p">
          <Link component={RouterLink} to="/">
            Open account flow
          </Link>
        </Typography>
      </Stack>
    </Box>
  )
}
