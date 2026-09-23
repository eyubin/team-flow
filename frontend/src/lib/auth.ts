import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './queryKeys.ts'

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
  return useQuery({ queryKey: queryKeys.auth.me(), queryFn: fetchProfile })
}
