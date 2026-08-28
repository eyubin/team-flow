import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

const csrfCookie = 'XSRF-TOKEN'

type Profile = {
  email: string
  displayName: string
}

type Mode = 'login' | 'register'

function csrfToken() {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${csrfCookie}=`))
    ?.split('=')[1]
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: Profile | null) => setProfile(body))
      .catch(() => setProfile(null))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await fetch('/api/auth/csrf', { credentials: 'include' })
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken() ?? '' },
        body: JSON.stringify(mode === 'login' ? { email, password } : { email, password, displayName }),
      })
      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as { detail?: string } | null
        throw new Error(problem?.detail ?? `Request failed (${response.status})`)
      }
      setProfile((await response.json()) as Profile)
      setMessage('Signed in')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await fetch('/api/auth/csrf', { credentials: 'include' })
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': csrfToken() ?? '' },
    })
    setProfile(null)
    setMessage('Signed out')
  }

  if (profile) {
    return (
      <main className="page">
        <p className="eyebrow">TeamFlow account</p>
        <h1>Welcome, {profile.displayName}</h1>
        <p className="lede">{profile.email}</p>
        <button type="button" onClick={logout}>Sign out</button>
        <p aria-live="polite">{message}</p>
      </main>
    )
  }

  return (
    <main className="page auth-page">
      <p className="eyebrow">TeamFlow account</p>
      <h1>{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
      <p className="lede">Use the local account flow to enter your workspace.</p>
      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && (
          <label>
            Display name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={320} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} />
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Working...' : mode === 'login' ? 'Sign in' : 'Register'}</button>
      </form>
      <button type="button" className="link-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account?' : 'Already registered?'}
      </button>
      <p aria-live="polite" className="form-message">{message}</p>
    </main>
  )
}
