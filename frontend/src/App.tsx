import { Route, Routes } from 'react-router-dom'
import { StatusPage } from './pages/StatusPage.tsx'
import { AuthPage } from './pages/AuthPage.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { TaskBoardPage } from './pages/TaskBoardPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StatusPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/projects/:projectId/tasks" element={<TaskBoardPage />} />
    </Routes>
  )
}
