import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Card, Flex, Heading, Link, Text, TextField } from '@radix-ui/themes'
import { useProfile, type Profile } from '../lib/auth.ts'

const csrfCookie = 'XSRF-TOKEN'

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
  const navigate = useNavigate()

  const profileQuery = useProfile()

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
      navigate('/dashboard')
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
      <Flex align="center" justify="center" style={{ minHeight: 'calc(100vh - 12rem)' }}>
        <Box asChild maxWidth="30rem" width="100%">
          <main>
            <Flex direction="column" gap="3">
              <Text size="1" color="iris" weight="bold" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                TeamFlow account
              </Text>
              <Heading as="h1" size="7">
                Welcome, {profile.displayName}
              </Heading>
              <Text as="p" color="gray">
                {profile.email}
              </Text>
              <Flex gap="3" align="center">
                <Button type="button" variant="soft" color="gray" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
                  Sign out
                </Button>
                <Link href="/dashboard">Open dashboard</Link>
              </Flex>
              <Text aria-live="polite" as="p" color="gray" size="2">
                {message}
              </Text>
            </Flex>
          </main>
        </Box>
      </Flex>
    )
  }

  return (
    <Flex align="center" justify="center" style={{ minHeight: 'calc(100vh - 12rem)' }}>
      <Box asChild maxWidth="26rem" width="100%">
        <main>
          <Flex direction="column" gap="3" mb="4">
            <Text size="1" color="iris" weight="bold" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              TeamFlow account
            </Text>
            <Heading as="h1" size="7">
              {mode === 'login' ? 'Sign in' : 'Create your account'}
            </Heading>
            <Text as="p" color="gray">
              Use the local account flow to enter your workspace.
            </Text>
          </Flex>
          <Card size="3">
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <Flex direction="column" gap="4">
                {mode === 'register' && (
                  <Flex asChild direction="column" gap="1">
                    <label>
                      <Text weight="medium" size="2">
                        Display name
                      </Text>
                      <TextField.Root {...register('displayName')} maxLength={80} aria-invalid={!!errors.displayName} />
                      {errors.displayName && (
                        <Text role="alert" color="red" size="1">
                          {errors.displayName.message}
                        </Text>
                      )}
                    </label>
                  </Flex>
                )}
                <Flex asChild direction="column" gap="1">
                  <label>
                    <Text weight="medium" size="2">
                      Email
                    </Text>
                    <TextField.Root type="email" {...register('email')} maxLength={320} aria-invalid={!!errors.email} />
                    {errors.email && (
                      <Text role="alert" color="red" size="1">
                        {errors.email.message}
                      </Text>
                    )}
                  </label>
                </Flex>
                <Flex asChild direction="column" gap="1">
                  <label>
                    <Text weight="medium" size="2">
                      Password
                    </Text>
                    <TextField.Root type="password" {...register('password')} maxLength={128} aria-invalid={!!errors.password} />
                    {errors.password && (
                      <Text role="alert" color="red" size="1">
                        {errors.password.message}
                      </Text>
                    )}
                  </label>
                </Flex>
                <Button type="submit" disabled={authMutation.isPending}>
                  {authMutation.isPending ? 'Working...' : mode === 'login' ? 'Sign in' : 'Register'}
                </Button>
              </Flex>
            </form>
          </Card>
          <Flex mt="3" direction="column" gap="2">
            <Button type="button" variant="ghost" onClick={toggleMode} style={{ justifyContent: 'flex-start' }}>
              {mode === 'login' ? 'Need an account?' : 'Already registered?'}
            </Button>
            <Text aria-live="polite" as="p" color="gray" size="2">
              {message}
            </Text>
          </Flex>
        </main>
      </Box>
    </Flex>
  )
}
