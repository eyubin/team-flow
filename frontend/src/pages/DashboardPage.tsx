import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

const workspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
})

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
})

const memberSchema = z.object({
  email: z.string().min(1, 'Email is required').max(320).email('Enter a valid email address'),
  role: z.enum(['MEMBER', 'VIEWER', 'ADMIN']),
})

type WorkspaceValues = z.infer<typeof workspaceSchema>
type ProjectValues = z.infer<typeof projectSchema>
type MemberValues = z.infer<typeof memberSchema>

async function fetchWorkspaces() {
  await request('/api/auth/csrf')
  return (await request('/api/workspaces')) as Workspace[]
}

export function DashboardPage() {
  const [selectedWorkspace, setSelectedWorkspace] = useState('')
  const [message, setMessage] = useState('')
  const [actionForbidden, setActionForbidden] = useState(false)
  const queryClient = useQueryClient()

  const workspacesQuery = useQuery({ queryKey: ['workspaces'], queryFn: fetchWorkspaces })
  const workspaces = workspacesQuery.data ?? []
  // Falls back to the first workspace until the user explicitly picks one, so a
  // freshly created (or freshly loaded) workspace is usable without an extra click.
  const activeWorkspace = selectedWorkspace || workspaces[0]?.id || ''

  const projectsQuery = useQuery({
    queryKey: ['workspaces', activeWorkspace, 'projects'],
    queryFn: () => request(`/api/workspaces/${activeWorkspace}/projects`) as Promise<Project[]>,
    enabled: !!activeWorkspace,
  })
  const projects = projectsQuery.data ?? []

  const membersQuery = useQuery({
    queryKey: ['workspaces', activeWorkspace, 'members'],
    queryFn: () => request(`/api/workspaces/${activeWorkspace}/members`) as Promise<Member[]>,
    enabled: !!activeWorkspace,
  })
  const members = membersQuery.data ?? []

  const workspaceForm = useForm<WorkspaceValues>({ resolver: zodResolver(workspaceSchema), defaultValues: { name: '' } })
  const projectForm = useForm<ProjectValues>({ resolver: zodResolver(projectSchema), defaultValues: { name: '' } })
  const memberForm = useForm<MemberValues>({ resolver: zodResolver(memberSchema), defaultValues: { email: '', role: 'MEMBER' } })

  const createWorkspaceMutation = useMutation({
    mutationFn: (values: WorkspaceValues) => request('/api/workspaces', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      workspaceForm.reset()
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setMessage('Workspace created')
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to create workspace')
    },
  })

  const createProjectMutation = useMutation({
    mutationFn: (values: ProjectValues) =>
      request(`/api/workspaces/${activeWorkspace}/projects`, { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      projectForm.reset()
      void queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspace, 'projects'] })
      setMessage('Project created')
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to create project')
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: (values: MemberValues) =>
      request(`/api/workspaces/${activeWorkspace}/members`, { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      memberForm.reset()
      void queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspace, 'members'] })
      setMessage('Member added')
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to add member')
    },
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ member, role }: { member: Member; role: Member['role'] }) =>
      request(`/api/workspaces/${activeWorkspace}/members/${member.userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspace, 'members'] })
      setMessage('Member role updated')
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to update role')
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (member: Member) =>
      request(`/api/workspaces/${activeWorkspace}/members/${member.userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspace, 'members'] })
      setMessage('Member removed')
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to remove member')
    },
  })

  function changeRole(member: Member, role: Member['role']) {
    if (!activeWorkspace || role === member.role) return
    setActionForbidden(false)
    changeRoleMutation.mutate({ member, role })
  }

  function removeMember(member: Member) {
    if (!activeWorkspace || !window.confirm(`Remove ${member.displayName}?`)) return
    setActionForbidden(false)
    removeMemberMutation.mutate(member)
  }

  const loading = workspacesQuery.isLoading
  const forbidden = isForbidden(workspacesQuery.error) || isForbidden(projectsQuery.error) || isForbidden(membersQuery.error)

  if (loading) return <main className="page"><p aria-live="polite">Loading dashboard...</p></main>
  if (forbidden) return <Forbidden message="You don't have access to this dashboard." />

  const myRole = workspaces.find((workspace) => workspace.id === activeWorkspace)?.myRole

  return (
    <main className="page dashboard-page">
      <p className="eyebrow">TeamFlow workspace</p>
      <h1>Project dashboard</h1>
      <p className="lede">Create a workspace, then give it a project to hold future tasks.</p>
      <form
        onSubmit={workspaceForm.handleSubmit((values) => {
          setActionForbidden(false)
          createWorkspaceMutation.mutate(values)
        })}
        className="inline-form"
        noValidate
      >
        <label>
          New workspace
          <input {...workspaceForm.register('name')} maxLength={120} aria-invalid={!!workspaceForm.formState.errors.name} />
          {workspaceForm.formState.errors.name && <span role="alert" className="field-error">{workspaceForm.formState.errors.name.message}</span>}
        </label>
        <button type="submit" disabled={createWorkspaceMutation.isPending}>Create workspace</button>
      </form>
      {workspaces.length === 0 ? (
        <p className="empty-state">No workspaces yet.</p>
      ) : (
        <>
          <label>
            Workspace
            <select
              aria-label="Workspace"
              value={activeWorkspace}
              onChange={(event) => setSelectedWorkspace(event.target.value)}
            >
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} ({workspace.myRole})</option>)}
            </select>
          </label>
          <form
            onSubmit={projectForm.handleSubmit((values) => {
              setActionForbidden(false)
              createProjectMutation.mutate(values)
            })}
            className="inline-form"
            noValidate
          >
            <label>
              New project
              <input {...projectForm.register('name')} maxLength={120} aria-invalid={!!projectForm.formState.errors.name} />
              {projectForm.formState.errors.name && <span role="alert" className="field-error">{projectForm.formState.errors.name.message}</span>}
            </label>
            <button type="submit" disabled={createProjectMutation.isPending}>Create project</button>
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
                {members.map((member) => <li key={member.userId}><span><strong>{member.displayName}</strong><small>{member.email}</small></span>{myRole === 'ADMIN' ? <><select aria-label={`Role for ${member.displayName}`} value={member.role} onChange={(event) => changeRole(member, event.target.value as Member['role'])}><option value="ADMIN">Admin</option><option value="MEMBER">Member</option><option value="VIEWER">Viewer</option></select><button type="button" className="danger-button" onClick={() => removeMember(member)}>Remove</button></> : <span>{member.role}</span>}</li>)}
              </ul>
            )}
            {myRole === 'ADMIN' && (
              <form
                onSubmit={memberForm.handleSubmit((values) => {
                  setActionForbidden(false)
                  addMemberMutation.mutate(values)
                })}
                className="inline-form"
                noValidate
              >
                <label>
                  Email
                  <input type="email" {...memberForm.register('email')} aria-invalid={!!memberForm.formState.errors.email} />
                  {memberForm.formState.errors.email && <span role="alert" className="field-error">{memberForm.formState.errors.email.message}</span>}
                </label>
                <label>
                  Role
                  <select aria-label="Role" {...memberForm.register('role')}>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
                <button type="submit" disabled={addMemberMutation.isPending}>Add member</button>
              </form>
            )}
          </section>
        </>
      )}
      {actionForbidden && <p className="forbidden-state" role="alert">You don't have permission to do that. This action requires a higher role in this workspace.</p>}
      <p aria-live="polite" className="form-message">{message}</p>
    </main>
  )
}
