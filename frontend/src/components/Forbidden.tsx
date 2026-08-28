type ForbiddenProps = {
  message?: string
}

export function Forbidden({ message }: ForbiddenProps) {
  return (
    <main className="page forbidden-page">
      <p className="eyebrow">Access denied</p>
      <h1>You don't have permission to view this</h1>
      <p className="lede" role="alert">
        {message ?? "Your role in this workspace doesn't allow this. Ask an admin for access if you think this is a mistake."}
      </p>
      <p><a href="/dashboard">Back to dashboard</a></p>
    </main>
  )
}
