import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { FormEvent } from 'react'

type Task = {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  version: number
}

function csrfToken() {
  return document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))?.split('=')[1]
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

export function TaskBoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<Task['status']>('TODO')
  const [priority, setPriority] = useState<Task['priority']>('MEDIUM')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const loadTasks = useCallback(async () => {
    if (!projectId) return
    const body = (await request(`/api/projects/${projectId}/tasks?size=100&sort=createdAt,desc`)) as { content: Task[] }
    setTasks(body.content)
  }, [projectId])

  useEffect(() => {
    request('/api/auth/csrf')
      .then(() => loadTasks())
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Unable to load tasks'))
      .finally(() => setLoading(false))
  }, [loadTasks])

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!projectId) return
    try {
      await request(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ title, status, priority }),
      })
      setTitle('')
      await loadTasks()
      setMessage('Task created')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create task')
    }
  }

  if (loading) return <main className="page"><p>Loading tasks...</p></main>

  return (
    <main className="page dashboard-page">
      <p className="eyebrow">TeamFlow project</p>
      <h1>Task board</h1>
      <form onSubmit={createTask} className="inline-form">
        <label>
          New task
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as Task['status'])}>
            <option value="TODO">To do</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={(event) => setPriority(event.target.value as Task['priority'])}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
        <button type="submit">Create task</button>
      </form>
      {tasks.length === 0 ? <p className="empty-state">No tasks in this project yet.</p> : (
        <ul className="project-list">
          {tasks.map((task) => <li key={task.id}><strong>{task.title}</strong><span>{task.status} · {task.priority}</span></li>)}
        </ul>
      )}
      <p aria-live="polite" className="form-message">{message}</p>
      <p><a href="/dashboard">Back to dashboard</a></p>
    </main>
  )
}
