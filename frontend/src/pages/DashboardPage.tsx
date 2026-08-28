import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { isForbidden, request } from '../lib/api.ts'
import { Forbidden } from '../components/Forbidden.tsx'

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

type Member = {
  userId: string
  email: string
  displayName: string
  role: 'ADMIN' | 'MEMBER' | 'VIEWER'
}

export function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [workspaceName, setWorkspaceName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [selectedWorkspace, setSelectedWorkspace] = useState('')
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [message, setMessage] = useState('')
  const [actionForbidden, setActionForbidden] = useState(false)

  async function loadWorkspaces() {
    const body = (await request('/api/workspaces')) as Workspace[]
    setWorkspaces(body)
    const workspace = body[0]
    if (workspace) {
      setSelectedWorkspace((current) => current || workspace.id)
      setProjects((await request(`/api/workspaces/${workspace.id}/projects`)) as Project[])
      setMembers((await request(`/api/workspaces/${workspace.id}/members`)) as Member[])
    } else {
      setProjects([])
      setMembers([])
    }
  }

  useEffect(() => {
    request('/api/auth/csrf')
      .then(() => loadWorkspaces())
      .catch((error: unknown) => {
        if (isForbidden(error)) setForbidden(true)
        else setMessage(error instanceof Error ? error.message : 'Unable to load dashboard')
      })
      .finally(() => setLoading(false))
  }, [])

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionForbidden(false)
    try {
      await request('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: workspaceName }) })
      setWorkspaceName('')
      await loadWorkspaces()
      setMessage('Workspace created')
    } catch (error) {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to create workspace')
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedWorkspace) return
    setActionForbidden(false)
    try {
      await request(`/api/workspaces/${selectedWorkspace}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name: projectName }),
      })
      setProjectName('')
      setProjects((await request(`/api/workspaces/${selectedWorkspace}/projects`)) as Project[])
      setMessage('Project created')
    } catch (error) {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to create project')
    }
  }

  async function loadWorkspaceMembers(workspaceId: string) {
    setMembers((await request(`/api/workspaces/${workspaceId}/members`)) as Member[])
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedWorkspace) return
    setActionForbidden(false)
    const form = new FormData(event.currentTarget)
    try {
      await request(`/api/workspaces/${selectedWorkspace}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), role: form.get('role') }),
      })
      event.currentTarget.reset()
      await loadWorkspaceMembers(selectedWorkspace)
      setMessage('Member added')
    } catch (error) {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to add member')
    }
  }

  async function changeRole(member: Member, role: Member['role']) {
    if (!selectedWorkspace || role === member.role) return
    setActionForbidden(false)
    try {
      await request(`/api/workspaces/${selectedWorkspace}/members/${member.userId}`, {
        method: 'PATCH', body: JSON.stringify({ role }),
      })
      await loadWorkspaceMembers(selectedWorkspace)
      setMessage('Member role updated')
    } catch (error) {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to update role')
    }
  }

  async function removeMember(member: Member) {
    if (!selectedWorkspace || !window.confirm(`Remove ${member.displayName}?`)) return
    setActionForbidden(false)
    try {
      await request(`/api/workspaces/${selectedWorkspace}/members/${member.userId}`, { method: 'DELETE' })
      await loadWorkspaceMembers(selectedWorkspace)
      setMessage('Member removed')
    } catch (error) {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to remove member')
    }
  }

  if (loading) return <main className="page"><p aria-live="polite">Loading dashboard...</p></main>
  if (forbidden) return <Forbidden message="You don't have access to this dashboard." />

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
              await loadWorkspaceMembers(event.target.value)
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
                {projects.map((project) => <li key={project.id}><strong>{project.name}</strong><span>{project.description ?? 'Ready for tasks'}</span><a href={`/projects/${project.id}/tasks`}>Open task board</a></li>)}
              </ul>
            )}
          </section>
          <section aria-labelledby="members-heading" className="members-section">
            <h2 id="members-heading">Members</h2>
            {members.length === 0 ? <p className="empty-state">No members found.</p> : (
              <ul className="member-list">
                {members.map((member) => <li key={member.userId}><span><strong>{member.displayName}</strong><small>{member.email}</small></span>{workspaces.find((workspace) => workspace.id === selectedWorkspace)?.myRole === 'ADMIN' ? <><select aria-label={`Role for ${member.displayName}`} value={member.role} onChange={(event) => changeRole(member, event.target.value as Member['role'])}><option value="ADMIN">Admin</option><option value="MEMBER">Member</option><option value="VIEWER">Viewer</option></select><button type="button" className="danger-button" onClick={() => removeMember(member)}>Remove</button></> : <span>{member.role}</span>}</li>)}
              </ul>
            )}
            {workspaces.find((workspace) => workspace.id === selectedWorkspace)?.myRole === 'ADMIN' && <form onSubmit={addMember} className="inline-form"><label>Email<input name="email" type="email" required /></label><label>Role<select name="role" defaultValue="MEMBER"><option value="MEMBER">Member</option><option value="VIEWER">Viewer</option><option value="ADMIN">Admin</option></select></label><button type="submit">Add member</button></form>}
          </section>
        </>
      )}
      {actionForbidden && <p className="forbidden-state" role="alert">You don't have permission to do that. This action requires a higher role in this workspace.</p>}
      <p aria-live="polite" className="form-message">{message}</p>
    </main>
  )
}
