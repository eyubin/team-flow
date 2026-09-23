import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { csrfToken, request } from '../lib/api.ts'
import { broadcastSignedOut, clearSession, useProfile, type Profile } from '../lib/auth.ts'
import { firstErrorMessage } from '../lib/formError.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { StatusMessage, type StatusMessageValue } from '../components/StatusMessage.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

// Changing the email changes a login credential, so the API wants the current
// password for it. The schema needs the current email to know when that
// applies, hence a factory rather than a constant.
function profileSchema(currentEmail: string) {
  return z
    .object({
      displayName: z.string().trim().min(1, 'Display name is required').max(80),
      email: z.string().min(1, 'Email is required').max(320).email('Enter a valid email address'),
      currentPassword: z.string().max(128),
    })
    .superRefine((values, ctx) => {
      if (emailChanged(values.email, currentEmail) && !values.currentPassword) {
        ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: 'Enter your current password to change your email' })
      }
    })
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type ProfileValues = z.infer<ReturnType<typeof profileSchema>>
type PasswordValues = z.infer<typeof passwordSchema>

function emailChanged(email: string, currentEmail: string) {
  return email.trim().toLowerCase() !== currentEmail
}

async function mutate(url: string, method: 'PATCH' | 'PUT' | 'DELETE', body: unknown) {
  if (!csrfToken()) await request('/api/auth/csrf')
  return request(url, { method, body: JSON.stringify(body) })
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function AccountPage() {
  useDocumentTitle('Account settings')
  // RequireAuth only renders this route once the profile has loaded.
  const profile = useProfile().data!

  return (
    <Box component="main">
      <Stack spacing={4}>
        <Stack spacing={1.5}>
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
            TeamFlow account
          </Typography>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
            Account settings
          </Typography>
        </Stack>
        <ProfileSection profile={profile} />
        <PasswordSection email={profile.email} />
        <DeleteAccountSection />
        <Typography component="p">
          <Link component={RouterLink} to="/dashboard">
            Back to dashboard
          </Link>
        </Typography>
      </Stack>
    </Box>
  )
}

function ProfileSection({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<StatusMessageValue>(null)

  const form = useForm({
    defaultValues: { displayName: profile.displayName, email: profile.email, currentPassword: '' } as ProfileValues,
    validators: { onSubmit: profileSchema(profile.email) },
    onSubmit: ({ value }) => {
      setMessage(null)
      updateMutation.mutate(value)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (values: ProfileValues) =>
      mutate('/api/users/me', 'PATCH', {
        displayName: values.displayName.trim(),
        email: values.email.trim(),
        ...(emailChanged(values.email, profile.email) ? { currentPassword: values.currentPassword } : {}),
      }) as Promise<Profile>,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.auth.me(), updated)
      form.reset({ displayName: updated.displayName, email: updated.email, currentPassword: '' })
      setMessage({ text: 'Profile updated', tone: 'success' })
    },
    onError: (error: unknown) => setMessage({ text: errorText(error, 'Unable to update profile'), tone: 'error' }),
  })

  return (
    <Stack component="section" aria-labelledby="profile-heading" spacing={1.5}>
      <Typography variant="h5" component="h2" id="profile-heading" sx={{ fontWeight: 700 }}>
        Profile
      </Typography>
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
                    slotProps={{ htmlInput: { maxLength: 80 }, formHelperText: { role: 'alert' } }}
                  />
                )}
              </form.Field>
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
                    slotProps={{ htmlInput: { maxLength: 320 }, formHelperText: { role: 'alert' } }}
                  />
                )}
              </form.Field>
              <form.Subscribe selector={(state) => emailChanged(state.values.email, profile.email)}>
                {(changingEmail) =>
                  changingEmail && (
                    <form.Field name="currentPassword">
                      {(field) => (
                        <TextField
                          label="Current password"
                          type="password"
                          autoComplete="current-password"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          onBlur={field.handleBlur}
                          error={field.state.meta.errors.length > 0}
                          helperText={
                            firstErrorMessage(field.state.meta.errors) ?? 'Required to change the email you sign in with'
                          }
                          // Only an error should be announced; the hint is static.
                          slotProps={{
                            htmlInput: { maxLength: 128 },
                            formHelperText: field.state.meta.errors.length > 0 ? { role: 'alert' } : {},
                          }}
                        />
                      )}
                    </form.Field>
                  )
                }
              </form.Subscribe>
              <Box>
                <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
                  Save profile
                </Button>
              </Box>
            </Stack>
          </form>
        </CardContent>
      </Card>
      <StatusMessage value={message} />
    </Stack>
  )
}

function PasswordSection({ email }: { email: string }) {
  const [message, setMessage] = useState<StatusMessageValue>(null)

  const form = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } as PasswordValues,
    validators: { onSubmit: passwordSchema },
    onSubmit: ({ value }) => {
      setMessage(null)
      changePasswordMutation.mutate(value)
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordValues) =>
      mutate('/api/users/me/password', 'PUT', { currentPassword, newPassword }),
    onSuccess: () => {
      form.reset()
      setMessage({ text: 'Password changed', tone: 'success' })
    },
    onError: (error: unknown) => setMessage({ text: errorText(error, 'Unable to change password'), tone: 'error' }),
  })

  const fields = [
    { name: 'currentPassword', label: 'Current password', autoComplete: 'current-password' },
    { name: 'newPassword', label: 'New password', autoComplete: 'new-password' },
    { name: 'confirmPassword', label: 'Confirm new password', autoComplete: 'new-password' },
  ] as const

  return (
    <Stack component="section" aria-labelledby="password-heading" spacing={1.5}>
      <Typography variant="h5" component="h2" id="password-heading" sx={{ fontWeight: 700 }}>
        Password
      </Typography>
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
              {/* Lets password managers attach the new password to the right account. */}
              <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
              {fields.map(({ name, label, autoComplete }) => (
                <form.Field key={name} name={name}>
                  {(field) => (
                    <TextField
                      label={label}
                      type="password"
                      autoComplete={autoComplete}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      error={field.state.meta.errors.length > 0}
                      helperText={firstErrorMessage(field.state.meta.errors)}
                      slotProps={{ htmlInput: { maxLength: 128 }, formHelperText: { role: 'alert' } }}
                    />
                  )}
                </form.Field>
              ))}
              <Box>
                <Button type="submit" variant="contained" disabled={changePasswordMutation.isPending}>
                  Change password
                </Button>
              </Box>
            </Stack>
          </form>
        </CardContent>
      </Card>
      <StatusMessage value={message} />
    </Stack>
  )
}

function DeleteAccountSection() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')

  const deleteMutation = useMutation({
    mutationFn: () => mutate('/api/users/me', 'DELETE', { password }),
    // The server has already expired this browser's cookies and rejects the
    // account's tokens everywhere; this ends the session in the UI, here and
    // in the user's other tabs.
    onSuccess: () => {
      clearSession(queryClient)
      broadcastSignedOut()
      navigate('/', { replace: true })
    },
  })

  function close() {
    setOpen(false)
    setPassword('')
    deleteMutation.reset()
  }

  return (
    <Stack component="section" aria-labelledby="delete-account-heading" spacing={1.5}>
      <Typography variant="h5" component="h2" id="delete-account-heading" sx={{ fontWeight: 700 }}>
        Delete account
      </Typography>
      <Card sx={(theme) => ({ borderColor: theme.palette.error.main })}>
        <CardContent>
          <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Typography color="text.secondary">
              Your name and email are removed and you are signed out everywhere. Workspaces where you are the only
              member are deleted; elsewhere you are removed and your tasks are unassigned. This can't be undone.
            </Typography>
            <Button type="button" color="error" variant="outlined" onClick={() => setOpen(true)}>
              Delete account
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onClose={close}
        slotProps={{ paper: { role: 'alertdialog', sx: { maxWidth: '28rem' } } }}
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (password) deleteMutation.mutate()
          }}
          noValidate
        >
          <DialogTitle id="delete-account-title">Delete your account?</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <DialogContentText id="delete-account-description">
                This permanently deletes your account. Enter your password to confirm.
              </DialogContentText>
              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 128 } }}
              />
              {deleteMutation.isError && (
                <Alert severity="error">{errorText(deleteMutation.error, 'Unable to delete account')}</Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" color="inherit" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" color="error" variant="contained" disabled={!password || deleteMutation.isPending}>
              Delete account
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  )
}
