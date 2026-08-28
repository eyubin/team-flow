import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { FormEvent } from 'react'
import { ApiError, isForbidden, request } from '../lib/api.ts'
import { Forbidden } from '../components/Forbidden.tsx'

type Task = {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  assigneeId?: string
  version: number
}

type Comment = { id: string; body: string; createdAt: string }
type AuditEvent = { id: string; action: string; createdAt: string }

export function TaskBoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<Task['status']>('TODO')
  const [priority, setPriority] = useState<Task['priority']>('MEDIUM')
  const [filterStatus, setFilterStatus] = useState<Task['status'] | ''>('')
  const [filterPriority, setFilterPriority] = useState<Task['priority'] | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [message, setMessage] = useState('')
  const [actionForbidden, setActionForbidden] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editStatus, setEditStatus] = useState<Task['status']>('TODO')
  const [editPriority, setEditPriority] = useState<Task['priority']>('MEDIUM')
  const [commentBody, setCommentBody] = useState('')
  const [comments, setComments] = useState<Comment[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [hasConflict, setHasConflict] = useState(false)

  const loadTasks = useCallback(async () => {
    if (!projectId) return
    const query = new URLSearchParams({ size: '100', sort: 'createdAt,desc' })
    if (filterStatus) query.set('status', filterStatus)
    if (filterPriority) query.set('priority', filterPriority)
    if (assigneeFilter.trim()) query.set('assigneeId', assigneeFilter.trim())
    const body = (await request(`/api/projects/${projectId}/tasks?${query}`)) as { content: Task[] }
    setTasks(body.content)
  }, [assigneeFilter, filterPriority, filterStatus, projectId])

  useEffect(() => {
    request('/api/auth/csrf')
      .then(() => loadTasks())
      .catch((error: unknown) => {
        if (isForbidden(error)) setForbidden(true)
        else setMessage(error instanceof Error ? error.message : 'Unable to load tasks')
      })
      .finally(() => setLoading(false))
  }, [loadTasks])

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!projectId) return
    setActionForbidden(false)
    try {
      await request(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ title, status, priority }),
      })
      setTitle('')
      await loadTasks()
      setMessage('Task created')
    } catch (error) {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to create task')
    }
  }

  async function selectTask(task: Task) {
    setSelectedTask(task)
    setHasConflict(false)
    setActionForbidden(false)
    setEditTitle(task.title)
    setEditStatus(task.status)
    setEditPriority(task.priority)
    try {
      const [commentList, auditPage] = await Promise.all([
        request(`/api/tasks/${task.id}/comments`),
        request(`/api/audit-events?entityType=TASK&entityId=${task.id}`),
      ])
      setComments(commentList as Comment[])
      setAuditEvents((auditPage as { content: AuditEvent[] }).content)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load task details')
    }
  }

  async function updateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTask) return
    setActionForbidden(false)
    try {
      const updated = (await request(`/api/tasks/${selectedTask.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ version: selectedTask.version, title: editTitle, status: editStatus, priority: editPriority }),
      })) as Task
      setTasks((current) => current.map((task) => task.id === updated.id ? updated : task))
      setSelectedTask(updated)
      setHasConflict(false)
      setMessage('Task updated')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setHasConflict(true)
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof ApiError && error.status === 409
        ? 'Conflict: this task changed elsewhere. Reload the task before saving again.'
        : error instanceof Error ? error.message : 'Unable to update task')
    }
  }

  async function reloadSelectedTask() {
    if (!selectedTask) return
    try {
      const fresh = (await request(`/api/tasks/${selectedTask.id}`)) as Task
      setTasks((current) => current.map((task) => task.id === fresh.id ? fresh : task))
      await selectTask(fresh)
      setMessage('Task reloaded')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reload task')
    }
  }

  async function deleteSelectedTask() {
    if (!selectedTask || !window.confirm(`Delete ${selectedTask.title}?`)) return
    setActionForbidden(false)
    try {
      await request(`/api/tasks/${selectedTask.id}`, { method: 'DELETE' })
      setTasks((current) => current.filter((task) => task.id !== selectedTask.id))
      setSelectedTask(null)
      setMessage('Task deleted')
    } catch (error) {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to delete task')
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTask) return
    setActionForbidden(false)
    try {
      const comment = (await request(`/api/tasks/${selectedTask.id}/comments`, {
        method: 'POST', body: JSON.stringify({ body: commentBody }),
      })) as Comment
      setComments((current) => [comment, ...current])
      setCommentBody('')
      setMessage('Comment added')
    } catch (error) {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to add comment')
    }
  }

  if (loading) return <main className="page"><p>Loading tasks...</p></main>
  if (forbidden) return <Forbidden message="You don't have access to this project's task board." />

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
      <form className="filter-form" onSubmit={(event) => { event.preventDefault(); void loadTasks() }}>
        <label>Filter status<select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as Task['status'] | '')}><option value="">All statuses</option><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select></label>
        <label>Filter priority<select value={filterPriority} onChange={(event) => setFilterPriority(event.target.value as Task['priority'] | '')}><option value="">All priorities</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
        <label>Assignee ID<input value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} placeholder="Optional UUID" /></label>
        <button type="submit">Apply filters</button>
        <button type="button" className="link-button" onClick={() => { setFilterStatus(''); setFilterPriority(''); setAssigneeFilter(''); }}>Clear</button>
      </form>
      {tasks.length === 0 ? <p className="empty-state">No tasks in this project yet.</p> : (
        <ul className="project-list">
          {tasks.map((task) => <li key={task.id}><button type="button" className="task-select" onClick={() => selectTask(task)}><strong>{task.title}</strong><span>{task.status} · {task.priority}</span></button></li>)}
        </ul>
      )}
      {selectedTask && (
        <section className="task-detail" aria-labelledby="task-detail-heading">
          <h2 id="task-detail-heading">Task details</h2>
          <form onSubmit={updateTask} className="inline-form">
            <label>Title<input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required maxLength={200} /></label>
            <label>Status<select value={editStatus} onChange={(event) => setEditStatus(event.target.value as Task['status'])}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select></label>
            <label>Priority<select value={editPriority} onChange={(event) => setEditPriority(event.target.value as Task['priority'])}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
            <button type="submit">Save task</button>
            <button type="button" className="danger-button" onClick={deleteSelectedTask}>Delete task</button>
          </form>
          {hasConflict && <p className="conflict-state" role="alert">This task has changed on the server. <button type="button" className="link-button" onClick={reloadSelectedTask}>Reload task</button></p>}
          <h3>Comments</h3>
          <form onSubmit={addComment} className="inline-form"><label>Comment<input value={commentBody} onChange={(event) => setCommentBody(event.target.value)} required maxLength={4000} /></label><button type="submit">Add comment</button></form>
          {comments.length === 0 ? <p className="empty-state">No comments yet.</p> : <ul className="detail-list">{comments.map((comment) => <li key={comment.id}>{comment.body}</li>)}</ul>}
          <h3>History</h3>
          {auditEvents.length === 0 ? <p className="empty-state">No history yet.</p> : <ul className="detail-list">{auditEvents.map((event) => <li key={event.id}>{event.action}</li>)}</ul>}
        </section>
      )}
      {actionForbidden && <p className="forbidden-state" role="alert">You don't have permission to do that. Your role in this project is read-only.</p>}
      <p aria-live="polite" className="form-message">{message}</p>
      <p><a href="/dashboard">Back to dashboard</a></p>
    </main>
  )
}
