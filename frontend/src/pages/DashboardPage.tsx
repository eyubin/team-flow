import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type Workspace = {
  id: string
  name: string
  myRole: string
}

type Project = {
  id: string
  workspaceId: string
  name: string
  description?: string
}

function csrfToken() {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
    ?.split('=')[1]
}

async function request(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.method && options.method !== 'GET' ? { 'X-XSRF-TOKEN': csrfToken() ?? '' } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.status === 204 ? null : response.json()
}

export function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [workspaceName, setWorkspaceName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [selectedWorkspace, setSelectedWorkspace] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  async function loadWorkspaces() {
    const body = (await request('/api/workspaces')) as Workspace[]
    setWorkspaces(body)
    const workspace = body[0]
    if (workspace) {
      setSelectedWorkspace((current) => current || workspace.id)
      setProjects((await request(`/api/workspaces/${workspace.id}/projects`)) as Project[])
    } else {
      setProjects([])
    }
  }

  useEffect(() => {
    request('/api/auth/csrf')
      .then(() => loadWorkspaces())
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Unable to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await request('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: workspaceName }) })
      setWorkspaceName('')
      await loadWorkspaces()
      setMessage('Workspace created')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create workspace')
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedWorkspace) return
    try {
      await request(`/api/workspaces/${selectedWorkspace}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name: projectName }),
      })
      setProjectName('')
      setProjects((await request(`/api/workspaces/${selectedWorkspace}/projects`)) as Project[])
      setMessage('Project created')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create project')
    }
  }

  if (loading) return <main className="page"><p aria-live="polite">Loading dashboard...</p></main>

  return (
    <main className="page dashboard-page">
      <p className="eyebrow">TeamFlow workspace</p>
      <h1>Project dashboard</h1>
      <p className="lede">Create a workspace, then give it a project to hold future tasks.</p>
      <form onSubmit={createWorkspace} className="inline-form">
        <label>
          New workspace
          <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} required maxLength={120} />
        </label>
        <button type="submit">Create workspace</button>
      </form>
      {workspaces.length === 0 ? (
        <p className="empty-state">No workspaces yet.</p>
      ) : (
        <>
          <label>
            Workspace
            <select value={selectedWorkspace} onChange={async (event) => {
              setSelectedWorkspace(event.target.value)
              setProjects((await request(`/api/workspaces/${event.target.value}/projects`)) as Project[])
            }}>
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} ({workspace.myRole})</option>)}
            </select>
          </label>
          <form onSubmit={createProject} className="inline-form">
            <label>
              New project
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} required maxLength={120} />
            </label>
            <button type="submit">Create project</button>
          </form>
          <section aria-labelledby="projects-heading">
            <h2 id="projects-heading">Projects</h2>
            {projects.length === 0 ? <p className="empty-state">No projects in this workspace yet.</p> : (
              <ul className="project-list">
                {projects.map((project) => <li key={project.id}><strong>{project.name}</strong><span>{project.description ?? 'Ready for tasks'}</span></li>)}
              </ul>
            )}
          </section>
        </>
      )}
      <p aria-live="polite" className="form-message">{message}</p>
    </main>
  )
}
