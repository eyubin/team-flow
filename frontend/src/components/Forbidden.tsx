import { Link as RouterLink } from 'react-router-dom'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

type ForbiddenProps = {
  message?: string
}

export function Forbidden({ message }: ForbiddenProps) {
  useDocumentTitle('Access denied')
  return (
    <Box component="main" sx={{ maxWidth: '30rem' }}>
      <Stack spacing={2}>
        <Typography variant="overline" color="error.main" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
          Access denied
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          You don't have permission to view this
        </Typography>
        <Alert severity="error" icon={<LockOutlinedIcon fontSize="inherit" />}>
          {message ?? "Your role in this workspace doesn't allow this. Ask an admin for access if you think this is a mistake."}
        </Alert>
        <Typography component="p">
          <Link component={RouterLink} to="/dashboard">
            Back to dashboard
          </Link>
        </Typography>
      </Stack>
    </Box>
  )
}
