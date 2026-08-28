import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

type TaskPage = { content: Task[] }
type Comment = { id: string; body: string; createdAt: string }
type AuditEvent = { id: string; action: string; createdAt: string }

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  assigneeId: z.string(),
})
type TaskFormValues = z.infer<typeof taskFormSchema>

const commentSchema = z.object({
  body: z.string().min(1, 'Comment is required').max(4000),
})
type CommentValues = z.infer<typeof commentSchema>

async function fetchTasks(projectId: string, filterStatus: string, filterPriority: string, assigneeFilter: string) {
  await request('/api/auth/csrf')
  const query = new URLSearchParams({ size: '100', sort: 'createdAt,desc' })
  if (filterStatus) query.set('status', filterStatus)
  if (filterPriority) query.set('priority', filterPriority)
  if (assigneeFilter.trim()) query.set('assigneeId', assigneeFilter.trim())
  return (await request(`/api/projects/${projectId}/tasks?${query}`)) as TaskPage
}

function taskToFormValues(task: Task): TaskFormValues {
  return { title: task.title, status: task.status, priority: task.priority, assigneeId: task.assigneeId ?? '' }
}

export function TaskBoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()

  const [filterStatus, setFilterStatus] = useState<Task['status'] | ''>('')
  const [filterPriority, setFilterPriority] = useState<Task['priority'] | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [message, setMessage] = useState('')
  const [actionForbidden, setActionForbidden] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [hasConflict, setHasConflict] = useState(false)

  const tasksQueryKey = ['tasks', projectId, filterStatus, filterPriority, assigneeFilter] as const
  const tasksQuery = useQuery({
    queryKey: tasksQueryKey,
    queryFn: () => fetchTasks(projectId!, filterStatus, filterPriority, assigneeFilter),
    enabled: !!projectId,
  })
  const tasks = tasksQuery.data?.content ?? []
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null

  const commentsQuery = useQuery({
    queryKey: ['tasks', selectedTaskId, 'comments'],
    queryFn: () => request(`/api/tasks/${selectedTaskId}/comments`) as Promise<Comment[]>,
    enabled: !!selectedTaskId,
  })
  const comments = commentsQuery.data ?? []

  const auditQuery = useQuery({
    queryKey: ['audit-events', selectedTaskId],
    queryFn: () => request(`/api/audit-events?entityType=TASK&entityId=${selectedTaskId}`) as Promise<{ content: AuditEvent[] }>,
    enabled: !!selectedTaskId,
  })
  const auditEvents = auditQuery.data?.content ?? []

  const createForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { title: '', status: 'TODO', priority: 'MEDIUM', assigneeId: '' },
  })
  const editForm = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema) })
  const commentForm = useForm<CommentValues>({ resolver: zodResolver(commentSchema), defaultValues: { body: '' } })

  const createTaskMutation = useMutation({
    mutationFn: (values: TaskFormValues) =>
      request(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ ...values, assigneeId: values.assigneeId.trim() || null }),
      }),
    onSuccess: () => {
      createForm.reset()
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      setMessage('Task created')
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to create task')
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: (values: TaskFormValues) =>
      request(`/api/tasks/${selectedTask!.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...values, version: selectedTask!.version, assigneeId: values.assigneeId.trim() || null }),
      }) as Promise<Task>,
    onSuccess: (updated) => {
      queryClient.setQueriesData<TaskPage>({ queryKey: ['tasks', projectId] }, (old) =>
        old ? { ...old, content: old.content.map((task) => (task.id === updated.id ? updated : task)) } : old)
      setHasConflict(false)
      setMessage('Task updated')
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.status === 409) setHasConflict(true)
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof ApiError && error.status === 409
        ? 'Conflict: this task changed elsewhere. Reload the task before saving again.'
        : error instanceof Error ? error.message : 'Unable to update task')
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: () => request(`/api/tasks/${selectedTask!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.setQueriesData<TaskPage>({ queryKey: ['tasks', projectId] }, (old) =>
        old ? { ...old, content: old.content.filter((task) => task.id !== selectedTask!.id) } : old)
      setSelectedTaskId(null)
      setMessage('Task deleted')
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to delete task')
    },
  })

  const addCommentMutation = useMutation({
    mutationFn: (values: CommentValues) =>
      request(`/api/tasks/${selectedTask!.id}/comments`, { method: 'POST', body: JSON.stringify(values) }) as Promise<Comment>,
    onSuccess: (comment) => {
      queryClient.setQueryData<Comment[]>(['tasks', selectedTaskId, 'comments'], (old) => [comment, ...(old ?? [])])
      commentForm.reset()
      setMessage('Comment added')
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to add comment')
    },
  })

  function selectTask(task: Task) {
    setSelectedTaskId(task.id)
    setHasConflict(false)
    setActionForbidden(false)
    editForm.reset(taskToFormValues(task))
  }

  async function reloadSelectedTask() {
    if (!selectedTask) return
    try {
      const fresh = (await request(`/api/tasks/${selectedTask.id}`)) as Task
      queryClient.setQueriesData<TaskPage>({ queryKey: ['tasks', projectId] }, (old) =>
        old ? { ...old, content: old.content.map((task) => (task.id === fresh.id ? fresh : task)) } : old)
      editForm.reset(taskToFormValues(fresh))
      setHasConflict(false)
      void queryClient.invalidateQueries({ queryKey: ['tasks', fresh.id, 'comments'] })
      void queryClient.invalidateQueries({ queryKey: ['audit-events', fresh.id] })
      setMessage('Task reloaded')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reload task')
    }
  }

  function deleteSelectedTask() {
    if (!selectedTask || !window.confirm(`Delete ${selectedTask.title}?`)) return
    setActionForbidden(false)
    deleteTaskMutation.mutate()
  }

  const loading = tasksQuery.isLoading
  const forbidden = isForbidden(tasksQuery.error)

  if (loading) return <main className="page"><p>Loading tasks...</p></main>
  if (forbidden) return <Forbidden message="You don't have access to this project's task board." />

  return (
    <main className="page dashboard-page">
      <p className="eyebrow">TeamFlow project</p>
      <h1>Task board</h1>
      <form
        onSubmit={createForm.handleSubmit((values) => {
          setActionForbidden(false)
          createTaskMutation.mutate(values)
        })}
        className="inline-form"
        noValidate
      >
        <label>
          New task
          <input {...createForm.register('title')} maxLength={200} aria-invalid={!!createForm.formState.errors.title} />
          {createForm.formState.errors.title && <span role="alert" className="field-error">{createForm.formState.errors.title.message}</span>}
        </label>
        <label>
          Status
          <select aria-label="Status" {...createForm.register('status')}>
            <option value="TODO">To do</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
          </select>
        </label>
        <label>
          Priority
          <select aria-label="Priority" {...createForm.register('priority')}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
        <label>
          Assignee ID
          <input {...createForm.register('assigneeId')} placeholder="Optional UUID" />
        </label>
        <button type="submit" disabled={createTaskMutation.isPending}>Create task</button>
      </form>
      <form className="filter-form" onSubmit={(event) => { event.preventDefault(); void tasksQuery.refetch() }}>
        <label>Filter status<select aria-label="Filter status" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as Task['status'] | '')}><option value="">All statuses</option><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select></label>
        <label>Filter priority<select aria-label="Filter priority" value={filterPriority} onChange={(event) => setFilterPriority(event.target.value as Task['priority'] | '')}><option value="">All priorities</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
        <label>Filter by assignee ID<input value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} placeholder="Optional UUID" /></label>
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
          <form
            onSubmit={editForm.handleSubmit((values) => {
              setActionForbidden(false)
              updateTaskMutation.mutate(values)
            })}
            className="inline-form"
            noValidate
          >
            <label>Title<input {...editForm.register('title')} maxLength={200} aria-invalid={!!editForm.formState.errors.title} /></label>
            <label>Status<select aria-label="Task status" {...editForm.register('status')}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select></label>
            <label>Priority<select aria-label="Task priority" {...editForm.register('priority')}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
            <label>Task assignee ID<input {...editForm.register('assigneeId')} placeholder="Optional UUID" /></label>
            <button type="submit" disabled={updateTaskMutation.isPending}>Save task</button>
            <button type="button" className="danger-button" onClick={deleteSelectedTask}>Delete task</button>
          </form>
          {hasConflict && <p className="conflict-state" role="alert">This task has changed on the server. <button type="button" className="link-button" onClick={reloadSelectedTask}>Reload task</button></p>}
          <h3>Comments</h3>
          <form
            onSubmit={commentForm.handleSubmit((values) => {
              setActionForbidden(false)
              addCommentMutation.mutate(values)
            })}
            className="inline-form"
            noValidate
          >
            <label>Comment<input {...commentForm.register('body')} maxLength={4000} aria-invalid={!!commentForm.formState.errors.body} /></label>
            <button type="submit" disabled={addCommentMutation.isPending}>Add comment</button>
          </form>
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
