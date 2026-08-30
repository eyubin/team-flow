import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AppShell } from './components/layout/AppShell.tsx'
import { RequireAuth } from './components/RequireAuth.tsx'
import { StatusPage } from './pages/StatusPage.tsx'
import { AuthPage } from './pages/AuthPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { MembersPage } from './pages/MembersPage.tsx'
import { TaskBoardPage } from './pages/TaskBoardPage.tsx'
import { onUnauthorized } from './lib/api.ts'

export default function App() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    onUnauthorized(() => {
      queryClient.setQueryData(['auth', 'me'], null)
      navigate('/', { replace: true })
    })
    return () => onUnauthorized(null)
  }, [navigate, queryClient])

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="/status" element={<StatusPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workspaces/:workspaceId/members" element={<MembersPage />} />
          <Route path="/projects/:projectId/tasks" element={<TaskBoardPage />} />
        </Route>
      </Routes>
    </AppShell>
  )
}
