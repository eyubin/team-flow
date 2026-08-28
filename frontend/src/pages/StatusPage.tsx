import { HealthStatus } from '../components/HealthStatus.tsx'

export function StatusPage() {
  return (
    <main className="page">
      <h1>TeamFlow</h1>
      <p className="lede">
        Local skeleton is up when the API health check below reports <strong>UP</strong>.
      </p>
      <HealthStatus />
    </main>
  )
}
