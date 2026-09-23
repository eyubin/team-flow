import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

export function NotFoundPage() {
  useDocumentTitle('Page not found')

  return (
    <Box component="main" sx={{ maxWidth: '30rem' }}>
      <Stack spacing={2}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
          404
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Page not found
        </Typography>
        <Typography component="p" color="text.secondary">
          The page you're looking for doesn't exist or may have moved.
        </Typography>
        <Typography component="p">
          <Link component={RouterLink} to="/">
            Back to home
          </Link>
        </Typography>
      </Stack>
    </Box>
  )
}
