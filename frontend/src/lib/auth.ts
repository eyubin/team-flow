import { useQuery, type QueryClient } from '@tanstack/react-query'
import { ApiError } from './api.ts'
import { queryKeys } from './queryKeys.ts'

export type Profile = {
  id: string
  email: string
  displayName: string
}

// Only a 401 means "signed out". Anything else is thrown so RequireAuth can
// offer a retry, rather than signing a valid user out over a server blip -
// which matters now that the profile is re-checked on every window focus.
export async function fetchProfile(): Promise<Profile | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include' })
  if (response.status === 401) return null
  if (!response.ok) throw new ApiError(response.status)
  return (await response.json()) as Profile
}

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: fetchProfile,
    // The server rejects a deleted or signed-out account's cookies at once;
    // re-checking on focus is how another device's open tab finds out
    // without waiting for its next API call.
    refetchOnWindowFocus: true,
  })
}

/** Drops everything cached for the previous user and marks the session as gone. */
export function clearSession(queryClient: QueryClient) {
  queryClient.removeQueries()
  queryClient.setQueryData(queryKeys.auth.me(), null)
}

const AUTH_CHANNEL = 'teamflow-auth'
const SIGNED_OUT = 'signed-out'

/**
 * Tells this browser's other tabs the session has ended (sign-out or account
 * deletion). They share the now-expired cookies but would otherwise keep
 * showing cached data until their next request. A channel never receives its
 * own messages, so the sending tab isn't affected.
 */
export function broadcastSignedOut() {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(AUTH_CHANNEL)
  channel.postMessage(SIGNED_OUT)
  channel.close()
}

export function onSignedOutElsewhere(handler: () => void) {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const channel = new BroadcastChannel(AUTH_CHANNEL)
  channel.onmessage = (event: MessageEvent) => {
    if (event.data === SIGNED_OUT) handler()
  }
  return () => channel.close()
}
