import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell.tsx'
import { StatusPage } from './pages/StatusPage.tsx'
import { AuthPage } from './pages/AuthPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { MembersPage } from './pages/MembersPage.tsx'
import { TaskBoardPage } from './pages/TaskBoardPage.tsx'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/workspaces/:workspaceId/members" element={<MembersPage />} />
        <Route path="/projects/:projectId/tasks" element={<TaskBoardPage />} />
      </Routes>
    </AppShell>
  )
}
