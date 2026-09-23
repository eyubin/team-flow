import { http, HttpResponse } from 'msw'

export type Profile = { id: string; email: string; displayName: string }
export type Workspace = { id: string; name: string; myRole: string }
export type Project = { id: string; workspaceId: string; name: string; description?: string }
export type Member = { userId: string; email: string; displayName: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' }
export type Task = {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  assigneeId?: string
  version: number
}

export const profile: Profile = { id: 'user-1', email: 'ada@example.com', displayName: 'Ada Lovelace' }

export const workspace: Workspace = { id: 'workspace-1', name: 'Acme', myRole: 'ADMIN' }

export const project: Project = { id: 'project-1', workspaceId: 'workspace-1', name: 'Apollo' }

export const member: Member = { userId: 'user-2', email: 'grace@example.com', displayName: 'Grace Hopper', role: 'MEMBER' }

export const task: Task = { id: 'task-1', title: 'Original task', status: 'TODO', priority: 'MEDIUM', version: 0 }

/** RFC 7807 problem body, which is what lib/api.ts reads `detail` from. */
export function problem(status: number, detail: string) {
  return HttpResponse.json({ detail }, { status })
}

/**
 * Signed-out, empty-account defaults. Anything a test actually cares about is
 * layered on top with `server.use(...)` so each test states only its own
 * preconditions instead of an ordered script of fetch responses.
 */
export const handlers = [
  http.get('/api/auth/csrf', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/auth/me', () => new HttpResponse(null, { status: 401 })),
  http.post('/api/auth/login', () => HttpResponse.json(profile)),
  http.post('/api/auth/register', () => HttpResponse.json(profile, { status: 201 })),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/workspaces', () => HttpResponse.json([])),
  http.post('/api/workspaces', () => HttpResponse.json(workspace, { status: 201 })),
  http.get('/api/workspaces/:workspaceId/projects', () => HttpResponse.json([])),
  http.post('/api/workspaces/:workspaceId/projects', () => HttpResponse.json(project, { status: 201 })),
  http.get('/api/workspaces/:workspaceId/members', () => HttpResponse.json([])),
  http.post('/api/workspaces/:workspaceId/members', () => HttpResponse.json(member, { status: 201 })),
  http.patch('/api/workspaces/:workspaceId/members/:userId', () => new HttpResponse(null, { status: 204 })),
  http.delete('/api/workspaces/:workspaceId/members/:userId', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/projects/:projectId/tasks', () => HttpResponse.json({ content: [] })),
  http.post('/api/projects/:projectId/tasks', () => HttpResponse.json(task, { status: 201 })),
  http.get('/api/tasks/:taskId', () => HttpResponse.json(task)),
  http.patch('/api/tasks/:taskId', () => HttpResponse.json(task)),
  http.delete('/api/tasks/:taskId', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/tasks/:taskId/comments', () => HttpResponse.json([])),
  http.post('/api/tasks/:taskId/comments', () => HttpResponse.json({ id: 'comment-1', body: 'Looks good', createdAt: '2026-01-01T00:00:00Z' }, { status: 201 })),
  http.get('/api/audit-events', () => HttpResponse.json([])),

  http.get('/actuator/health', () => HttpResponse.json({ status: 'UP' })),
]
