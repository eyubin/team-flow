import { Route, Routes } from 'react-router-dom'
import { StatusPage } from './pages/StatusPage.tsx'
import { AuthPage } from './pages/AuthPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StatusPage />} />
      <Route path="/auth" element={<AuthPage />} />
    </Routes>
  )
}
