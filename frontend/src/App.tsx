import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppShell } from './components/layout/AppShell.tsx'
import { RequireAuth } from './components/RequireAuth.tsx'
import { AuthPage } from './pages/AuthPage.tsx'
import { onUnauthorized } from './lib/api.ts'
import { queryKeys } from './lib/queryKeys.ts'

// AuthPage is the landing route, so it stays in the main chunk. The rest are
// split out: MembersPage pulls in the DataGrid and TaskBoardPage pulls in
// TanStack Table and Virtual, none of which a signed-out visitor needs.
const StatusPage = lazy(() => import('./pages/StatusPage.tsx').then((m) => ({ default: m.StatusPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage.tsx').then((m) => ({ default: m.DashboardPage })))
const MembersPage = lazy(() => import('./pages/MembersPage.tsx').then((m) => ({ default: m.MembersPage })))
const TaskBoardPage = lazy(() => import('./pages/TaskBoardPage.tsx').then((m) => ({ default: m.TaskBoardPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.tsx').then((m) => ({ default: m.NotFoundPage })))

function RouteFallback() {
  return (
    <Box component="main">
      <Typography aria-live="polite">Loading...</Typography>
    </Box>
  )
}

export default function App() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    onUnauthorized(() => {
      queryClient.setQueryData(queryKeys.auth.me(), null)
      navigate('/', { replace: true })
    })
    return () => onUnauthorized(null)
  }, [navigate, queryClient])

  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/auth" element={<Navigate to="/" replace />} />
          <Route path="/status" element={<StatusPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/workspaces/:workspaceId/members" element={<MembersPage />} />
            <Route path="/projects/:projectId/tasks" element={<TaskBoardPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}
