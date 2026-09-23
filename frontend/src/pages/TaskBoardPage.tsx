import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { ApiError, isForbidden, request } from '../lib/api.ts'
import { Forbidden } from '../components/Forbidden.tsx'
import { QueryError } from '../components/QueryError.tsx'
import { StatusMessage, type StatusMessageValue } from '../components/StatusMessage.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

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

const STATUS_LABEL: Record<Task['status'], string> = { TODO: 'To do', IN_PROGRESS: 'In progress', DONE: 'Done' }
const PRIORITY_COLOR: Record<Task['priority'], 'default' | 'warning' | 'error'> = { LOW: 'default', MEDIUM: 'warning', HIGH: 'error' }
const STATUS_COLOR: Record<Task['status'], 'default' | 'primary' | 'success'> = { TODO: 'default', IN_PROGRESS: 'primary', DONE: 'success' }

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
  useDocumentTitle('Task board')
  const queryClient = useQueryClient()

  const [filterStatus, setFilterStatus] = useState<Task['status'] | ''>('')
  const [filterPriority, setFilterPriority] = useState<Task['priority'] | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [message, setMessage] = useState<StatusMessageValue>(null)
  const [actionForbidden, setActionForbidden] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [hasConflict, setHasConflict] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

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
      setMessage({ text: 'Task created', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage({ text: error instanceof Error ? error.message : 'Unable to create task', tone: 'error' })
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
      setMessage({ text: 'Task updated', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.status === 409) setHasConflict(true)
      if (isForbidden(error)) setActionForbidden(true)
      setMessage({
        text: error instanceof ApiError && error.status === 409
          ? 'Conflict: this task changed elsewhere. Reload the task before saving again.'
          : error instanceof Error ? error.message : 'Unable to update task',
        tone: 'error',
      })
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: () => request(`/api/tasks/${selectedTask!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.setQueriesData<TaskPage>({ queryKey: ['tasks', projectId] }, (old) =>
        old ? { ...old, content: old.content.filter((task) => task.id !== selectedTask!.id) } : old)
      setSelectedTaskId(null)
      setMessage({ text: 'Task deleted', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage({ text: error instanceof Error ? error.message : 'Unable to delete task', tone: 'error' })
    },
  })

  const addCommentMutation = useMutation({
    mutationFn: (values: CommentValues) =>
      request(`/api/tasks/${selectedTask!.id}/comments`, { method: 'POST', body: JSON.stringify(values) }) as Promise<Comment>,
    onSuccess: (comment) => {
      queryClient.setQueryData<Comment[]>(['tasks', selectedTaskId, 'comments'], (old) => [comment, ...(old ?? [])])
      commentForm.reset()
      setMessage({ text: 'Comment added', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage({ text: error instanceof Error ? error.message : 'Unable to add comment', tone: 'error' })
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
      setMessage({ text: 'Task reloaded', tone: 'success' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to reload task', tone: 'error' })
    }
  }

  function confirmDeleteSelectedTask() {
    setActionForbidden(false)
    setConfirmingDelete(false)
    deleteTaskMutation.mutate()
  }

  const loading = tasksQuery.isLoading
  const forbidden = isForbidden(tasksQuery.error)
  const failed = tasksQuery.isError && !isForbidden(tasksQuery.error)

  if (loading)
    return (
      <Box component="main">
        <Typography aria-live="polite">Loading tasks...</Typography>
      </Box>
    )
  if (forbidden) return <Forbidden message="You don't have access to this project's task board." />
  if (failed)
    return (
      <Box component="main">
        <QueryError message="We couldn't load this project's tasks." onRetry={() => void tasksQuery.refetch()} />
      </Box>
    )

  return (
    <Box component="main">
      <Stack spacing={4}>
        <Stack spacing={1.5}>
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
            TeamFlow project
          </Typography>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
            Task board
          </Typography>
        </Stack>

        <Card>
          <CardContent>
            <form
              onSubmit={createForm.handleSubmit((values) => {
                setActionForbidden(false)
                createTaskMutation.mutate(values)
              })}
              noValidate
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' }, flexWrap: 'wrap' }}>
                <TextField
                  label="New task"
                  sx={{ flexGrow: 1, minWidth: '12rem' }}
                  error={!!createForm.formState.errors.title}
                  helperText={createForm.formState.errors.title?.message}
                  slotProps={{ htmlInput: { maxLength: 200 }, formHelperText: { role: 'alert' } }}
                  {...createForm.register('title')}
                />
                <Controller
                  name="status"
                  control={createForm.control}
                  render={({ field }) => (
                    <TextField select label="Status" sx={{ minWidth: '9rem' }} {...field}>
                      <MenuItem value="TODO">To do</MenuItem>
                      <MenuItem value="IN_PROGRESS">In progress</MenuItem>
                      <MenuItem value="DONE">Done</MenuItem>
                    </TextField>
                  )}
                />
                <Controller
                  name="priority"
                  control={createForm.control}
                  render={({ field }) => (
                    <TextField select label="Priority" sx={{ minWidth: '9rem' }} {...field}>
                      <MenuItem value="LOW">Low</MenuItem>
                      <MenuItem value="MEDIUM">Medium</MenuItem>
                      <MenuItem value="HIGH">High</MenuItem>
                    </TextField>
                  )}
                />
                <TextField label="Assignee ID" placeholder="Optional UUID" {...createForm.register('assigneeId')} />
                <Button type="submit" variant="contained" disabled={createTaskMutation.isPending}>
                  Create task
                </Button>
              </Stack>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <form onSubmit={(event) => { event.preventDefault(); void tasksQuery.refetch() }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' }, flexWrap: 'wrap' }}>
                <TextField
                  select
                  label="Filter status"
                  sx={{ minWidth: '10rem' }}
                  value={filterStatus || 'ALL'}
                  onChange={(event) => setFilterStatus(event.target.value === 'ALL' ? '' : (event.target.value as Task['status']))}
                >
                  <MenuItem value="ALL">All statuses</MenuItem>
                  <MenuItem value="TODO">To do</MenuItem>
                  <MenuItem value="IN_PROGRESS">In progress</MenuItem>
                  <MenuItem value="DONE">Done</MenuItem>
                </TextField>
                <TextField
                  select
                  label="Filter priority"
                  sx={{ minWidth: '10rem' }}
                  value={filterPriority || 'ALL'}
                  onChange={(event) => setFilterPriority(event.target.value === 'ALL' ? '' : (event.target.value as Task['priority']))}
                >
                  <MenuItem value="ALL">All priorities</MenuItem>
                  <MenuItem value="LOW">Low</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="HIGH">High</MenuItem>
                </TextField>
                <TextField
                  label="Filter by assignee ID"
                  placeholder="Optional UUID"
                  value={assigneeFilter}
                  onChange={(event) => setAssigneeFilter(event.target.value)}
                />
                <Button type="submit" variant="outlined">
                  Apply filters
                </Button>
                <Button
                  type="button"
                  onClick={() => { setFilterStatus(''); setFilterPriority(''); setAssigneeFilter('') }}
                >
                  Clear
                </Button>
              </Stack>
            </form>
          </CardContent>
        </Card>

        {tasks.length === 0 ? (
          <Alert severity="info" role="status">
            No tasks in this project yet.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {tasks.map((task) => (
              <Card key={task.id} variant={task.id === selectedTaskId ? 'elevation' : 'outlined'}>
                <ButtonBase
                  onClick={() => selectTask(task)}
                  sx={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', p: 2 }}
                >
                  <Stack spacing={1} sx={{ width: '100%', alignItems: 'flex-start' }}>
                    <Typography sx={{ fontWeight: 700 }}>{task.title}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip size="small" color={STATUS_COLOR[task.status]} label={STATUS_LABEL[task.status]} />
                      <Chip size="small" color={PRIORITY_COLOR[task.priority]} label={task.priority} />
                    </Stack>
                  </Stack>
                </ButtonBase>
              </Card>
            ))}
          </Stack>
        )}

        {selectedTask && (
          <Stack component="section" aria-labelledby="task-detail-heading" spacing={2}>
            <Divider />
            <Typography variant="h5" component="h2" id="task-detail-heading" sx={{ fontWeight: 700 }}>
              Task details
            </Typography>
            <Card>
              <CardContent>
                <form
                  onSubmit={editForm.handleSubmit((values) => {
                    setActionForbidden(false)
                    updateTaskMutation.mutate(values)
                  })}
                  noValidate
                >
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' }, flexWrap: 'wrap' }}>
                      <TextField
                        label="Title"
                        sx={{ flexGrow: 1, minWidth: '12rem' }}
                        error={!!editForm.formState.errors.title}
                        helperText={editForm.formState.errors.title?.message}
                        slotProps={{ htmlInput: { maxLength: 200 }, formHelperText: { role: 'alert' } }}
                        {...editForm.register('title')}
                      />
                      <Controller
                        name="status"
                        control={editForm.control}
                        render={({ field }) => (
                          <TextField select label="Task status" sx={{ minWidth: '9rem' }} {...field}>
                            <MenuItem value="TODO">To do</MenuItem>
                            <MenuItem value="IN_PROGRESS">In progress</MenuItem>
                            <MenuItem value="DONE">Done</MenuItem>
                          </TextField>
                        )}
                      />
                      <Controller
                        name="priority"
                        control={editForm.control}
                        render={({ field }) => (
                          <TextField select label="Task priority" sx={{ minWidth: '9rem' }} {...field}>
                            <MenuItem value="LOW">Low</MenuItem>
                            <MenuItem value="MEDIUM">Medium</MenuItem>
                            <MenuItem value="HIGH">High</MenuItem>
                          </TextField>
                        )}
                      />
                      <TextField label="Task assignee ID" placeholder="Optional UUID" {...editForm.register('assigneeId')} />
                    </Stack>
                    <Stack direction="row" spacing={1.5}>
                      <Button type="submit" variant="contained" disabled={updateTaskMutation.isPending}>
                        Save task
                      </Button>
                      <Button type="button" color="error" variant="outlined" onClick={() => setConfirmingDelete(true)}>
                        Delete task
                      </Button>
                    </Stack>
                  </Stack>
                </form>
              </CardContent>
            </Card>

            {hasConflict && (
              <Alert severity="warning">
                This task has changed on the server.{' '}
                <Link component="button" type="button" onClick={reloadSelectedTask}>
                  Reload task
                </Link>
              </Alert>
            )}

            <Stack spacing={1.5}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>
                Comments
              </Typography>
              <form
                onSubmit={commentForm.handleSubmit((values) => {
                  setActionForbidden(false)
                  addCommentMutation.mutate(values)
                })}
                noValidate
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                  <TextField
                    label="Comment"
                    sx={{ flexGrow: 1, minWidth: '12rem' }}
                    error={!!commentForm.formState.errors.body}
                    helperText={commentForm.formState.errors.body?.message}
                    slotProps={{ htmlInput: { maxLength: 4000 }, formHelperText: { role: 'alert' } }}
                    {...commentForm.register('body')}
                  />
                  <Button type="submit" variant="contained" disabled={addCommentMutation.isPending}>
                    Add comment
                  </Button>
                </Stack>
              </form>
              {commentsQuery.isLoading ? (
                <Typography component="p" variant="body2" color="text.secondary" aria-live="polite">
                  Loading comments...
                </Typography>
              ) : comments.length === 0 ? (
                <Alert severity="info" role="status">
                  No comments yet.
                </Alert>
              ) : (
                <Stack spacing={1}>
                  {comments.map((comment) => (
                    <Card key={comment.id} variant="outlined">
                      <CardContent sx={{ py: 1.5 }}>
                        <Typography component="p" variant="body2">
                          {comment.body}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>

            <Stack spacing={1.5}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>
                History
              </Typography>
              {auditQuery.isLoading ? (
                <Typography component="p" variant="body2" color="text.secondary" aria-live="polite">
                  Loading history...
                </Typography>
              ) : auditEvents.length === 0 ? (
                <Alert severity="info" role="status">
                  No history yet.
                </Alert>
              ) : (
                <Stack spacing={0.5}>
                  {auditEvents.map((event) => (
                    <Typography component="p" key={event.id} variant="body2" color="text.secondary">
                      {event.action}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Stack>
          </Stack>
        )}

        {actionForbidden && (
          <Alert severity="error">You don't have permission to do that. Your role in this project is read-only.</Alert>
        )}
        <StatusMessage value={message} />
        <Typography component="p">
          <Link component={RouterLink} to="/dashboard">
            Back to dashboard
          </Link>
        </Typography>
      </Stack>

      <Dialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        slotProps={{ paper: { role: 'alertdialog', sx: { maxWidth: '26rem' } } }}
        aria-labelledby="delete-task-title"
        aria-describedby="delete-task-description"
      >
        <DialogTitle id="delete-task-title">Delete task</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-task-description">
            Delete {selectedTask?.title}? This can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={confirmDeleteSelectedTask}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
