import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const csrfCookie = 'XSRF-TOKEN'

type Profile = {
  email: string
  displayName: string
}

type Mode = 'login' | 'register'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').max(320).email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

const registerSchema = loginSchema.extend({
  displayName: z.string().min(1, 'Display name is required').max(80),
})

type LoginValues = z.infer<typeof loginSchema>
type RegisterValues = z.infer<typeof registerSchema>

function csrfToken() {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${csrfCookie}=`))
    ?.split('=')[1]
}

async function fetchProfile(): Promise<Profile | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include' })
  return response.ok ? ((await response.json()) as Profile) : null
}

async function authenticate(mode: Mode, values: LoginValues | RegisterValues): Promise<Profile> {
  await fetch('/api/auth/csrf', { credentials: 'include' })
  const response = await fetch(`/api/auth/${mode}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken() ?? '' },
    body: JSON.stringify(values),
  })
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null
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
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()

  const profileQuery = useQuery({ queryKey: ['auth', 'me'], queryFn: fetchProfile })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(mode === 'register' ? registerSchema : loginSchema) as unknown as Resolver<RegisterValues>,
    defaultValues: { email: '', password: '', displayName: '' },
  })

  const authMutation = useMutation({
    mutationFn: (values: LoginValues | RegisterValues) => authenticate(mode, values),
    onSuccess: (profile) => {
      queryClient.setQueryData(['auth', 'me'], profile)
      setMessage('Signed in')
    },
    onError: (error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'Request failed')
    },
  })

  const logoutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null)
      setMessage('Signed out')
    },
  })

  function onSubmit(values: RegisterValues) {
    setMessage('')
    authMutation.mutate(mode === 'register' ? values : { email: values.email, password: values.password })
  }

  function toggleMode() {
    setMode((current) => (current === 'login' ? 'register' : 'login'))
    reset()
  }

  const profile = profileQuery.data

  if (profile) {
    return (
      <main className="page">
        <p className="eyebrow">TeamFlow account</p>
        <h1>Welcome, {profile.displayName}</h1>
        <p className="lede">{profile.email}</p>
        <button type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>Sign out</button>
        <p><a href="/dashboard">Open dashboard</a></p>
        <p aria-live="polite">{message}</p>
      </main>
    )
  }

  return (
    <main className="page auth-page">
      <p className="eyebrow">TeamFlow account</p>
      <h1>{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
      <p className="lede">Use the local account flow to enter your workspace.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="auth-form" noValidate>
        {mode === 'register' && (
          <label>
            Display name
            <input {...register('displayName')} maxLength={80} aria-invalid={!!errors.displayName} />
            {errors.displayName && <span role="alert" className="field-error">{errors.displayName.message}</span>}
          </label>
        )}
        <label>
          Email
          <input type="email" {...register('email')} maxLength={320} aria-invalid={!!errors.email} />
          {errors.email && <span role="alert" className="field-error">{errors.email.message}</span>}
        </label>
        <label>
          Password
          <input type="password" {...register('password')} maxLength={128} aria-invalid={!!errors.password} />
          {errors.password && <span role="alert" className="field-error">{errors.password.message}</span>}
        </label>
        <button type="submit" disabled={authMutation.isPending}>
          {authMutation.isPending ? 'Working...' : mode === 'login' ? 'Sign in' : 'Register'}
        </button>
      </form>
      <button type="button" className="link-button" onClick={toggleMode}>
        {mode === 'login' ? 'Need an account?' : 'Already registered?'}
      </button>
      <p aria-live="polite" className="form-message">{message}</p>
    </main>
  )
}
