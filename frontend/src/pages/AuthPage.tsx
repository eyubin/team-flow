import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useProfile, type Profile } from '../lib/auth.ts'
import { firstErrorMessage } from '../lib/formError.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { StatusMessage, type StatusMessageValue } from '../components/StatusMessage.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

const csrfCookie = 'XSRF-TOKEN'

type Mode = 'login' | 'register'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').max(320).email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

const registerSchema = loginSchema.extend({
  displayName: z.string().min(1, 'Display name is required').max(80),
})

// The form always carries a displayName field, so the login validator has to
// describe it too - it just leaves it unconstrained. Both schemas then cover
// the same shape, which is what lets the validator be swapped without a cast.
const loginFormSchema = loginSchema.extend({ displayName: z.string() })

type LoginValues = z.infer<typeof loginSchema>
type RegisterValues = z.infer<typeof registerSchema>

function csrfToken() {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${csrfCookie}=`))
    ?.split('=')[1]
}

async function authenticate(mode: Mode, values: LoginValues | RegisterValues): Promise<Profile> {
  await fetch('/api/auth/csrf', { credentials: 'include' })
  const response = await fetch(`/api/auth/${mode}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken() ?? '',
    },
    body: JSON.stringify(values),
  })
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      detail?: string
    } | null
    throw new Error(problem?.detail ?? `Request failed (${response.status})`)
  }
  return (await response.json()) as Profile
}

async function signOut() {
  await fetch('/api/auth/csrf', { credentials: 'include' })
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-XSRF-TOKEN': csrfToken() ?? '' },
  })
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [message, setMessage] = useState<StatusMessageValue>(null)
  const [showPassword, setShowPassword] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const profileQuery = useProfile()

  // Selecting the schema by mode needs no cast: both are Standard Schemas over
  // the same field set, where displayName is simply unconstrained on login.
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      displayName: '',
    } as RegisterValues,
    validators: {
      onSubmit: mode === 'register' ? registerSchema : loginFormSchema,
    },
    onSubmit: ({ value }) => {
      setMessage(null)
      authMutation.mutate(mode === 'register' ? value : { email: value.email, password: value.password })
    },
  })

  const authMutation = useMutation({
    mutationFn: (values: LoginValues | RegisterValues) => authenticate(mode, values),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.auth.me(), profile)
      setMessage({ text: 'Signed in', tone: 'success' })
      navigate('/dashboard')
    },
    onError: (error: unknown) => {
      setMessage({
        text: error instanceof Error ? error.message : 'Request failed',
        tone: 'error',
      })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.me(), null)
      setMessage({ text: 'Signed out', tone: 'success' })
    },
  })

  function toggleMode() {
    setMode((current) => (current === 'login' ? 'register' : 'login'))
    setShowPassword(false)
    form.reset()
  }

  const profile = profileQuery.data
  useDocumentTitle(profile ? 'Account' : mode === 'login' ? 'Sign in' : 'Create account')

  if (profile) {
    return (
      <Stack
        sx={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 12rem)',
        }}
      >
        <Box component="main" sx={{ maxWidth: '30rem', width: '100%' }}>
          <Stack spacing={1.5}>
            <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
              TeamFlow account
            </Typography>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              Welcome, {profile.displayName}
            </Typography>
            <Typography component="p" color="text.secondary">
              {profile.email}
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Button
                type="button"
                variant="outlined"
                color="inherit"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                Sign out
              </Button>
              <Link component={RouterLink} to="/dashboard">
                Open dashboard
              </Link>
            </Stack>
            <StatusMessage value={message} />
          </Stack>
        </Box>
      </Stack>
    )
  }

  return (
    <Stack
      sx={{
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 12rem)',
      }}
    >
      <Box component="main" sx={{ maxWidth: '26rem', width: '100%' }}>
        <Stack spacing={1.5} sx={{ mb: 3 }}>
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
            TeamFlow account
          </Typography>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            {mode === 'login' ? 'Sign in' : 'Create your account'}
          </Typography>
          <Typography component="p" color="text.secondary">
            Use the local account flow to enter your workspace.
          </Typography>
        </Stack>
        <Card>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
              }}
              noValidate
            >
              <Stack spacing={2}>
                {mode === 'register' && (
                  <form.Field name="displayName">
                    {(field) => (
                      <TextField
                        label="Display name"
                        autoComplete="name"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        error={field.state.meta.errors.length > 0}
                        helperText={firstErrorMessage(field.state.meta.errors)}
                        slotProps={{
                          htmlInput: { maxLength: 80 },
                          formHelperText: { role: 'alert' },
                        }}
                      />
                    )}
                  </form.Field>
                )}
                <form.Field name="email">
                  {(field) => (
                    <TextField
                      label="Email"
                      type="email"
                      autoComplete="email"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      error={field.state.meta.errors.length > 0}
                      helperText={firstErrorMessage(field.state.meta.errors)}
                      slotProps={{
                        htmlInput: { maxLength: 320 },
                        formHelperText: { role: 'alert' },
                      }}
                    />
                  )}
                </form.Field>
                <form.Field name="password">
                  {(field) => (
                    <TextField
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      error={field.state.meta.errors.length > 0}
                      helperText={firstErrorMessage(field.state.meta.errors)}
                      slotProps={{
                        htmlInput: { maxLength: 128 },
                        formHelperText: { role: 'alert' },
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                type="button"
                                edge="end"
                                size="small"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                onClick={() => setShowPassword((current) => !current)}
                              >
                                {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  )}
                </form.Field>
                <Button type="submit" variant="contained" disabled={authMutation.isPending}>
                  {authMutation.isPending ? 'Working...' : mode === 'login' ? 'Sign in' : 'Register'}
                </Button>
              </Stack>
            </form>
          </CardContent>
        </Card>
        <Stack spacing={1} sx={{ mt: 2, alignItems: 'flex-start' }}>
          <Button type="button" onClick={toggleMode}>
            {mode === 'login' ? 'Need an account?' : 'Already registered?'}
          </Button>
          <StatusMessage value={message} />
        </Stack>
      </Box>
    </Stack>
  )
}
