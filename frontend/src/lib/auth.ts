import { useQuery } from '@tanstack/react-query'

export type Profile = {
  id: string
  email: string
  displayName: string
}

export async function fetchProfile(): Promise<Profile | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include' })
  return response.ok ? ((await response.json()) as Profile) : null
}

export function useProfile() {
  return useQuery({ queryKey: ['auth', 'me'], queryFn: fetchProfile })
}
