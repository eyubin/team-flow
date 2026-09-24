import { useCallback, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createColumnHelper,
  createCoreRowModel,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { ApiError, isForbidden, request } from '../lib/api.ts'
import { firstErrorMessage } from '../lib/formError.ts'
import { queryKeys } from '../lib/queryKeys.ts'
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

const taskTableFeatures = tableFeatures({
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
})

const columnHelper = createColumnHelper<typeof taskTableFeatures, Task>()

// Long boards get virtualised rows; short ones render plainly, so the common
// case carries no scroll container and no windowing maths.
const VIRTUALIZE_ABOVE = 30
const ROW_HEIGHT = 53
const VIRTUAL_VIEWPORT = '32rem'

// Stable identity: useForm re-applies its options on every render, so a fresh
// object literal here would push these defaults back over a reset().
const EMPTY_TASK_FORM: TaskFormValues = { title: '', status: 'TODO', priority: 'MEDIUM', assigneeId: '' }
const EMPTY_COMMENT_FORM: CommentValues = { body: '' }

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

type TaskEditFormProps = {
  task: Task
  saving: boolean
  onSave: (values: TaskFormValues) => void
  onDelete: () => void
}

/**
 * The detail form lives in its own component so it can be remounted per task
 * version. TanStack Form reads `defaultValues` when a field mounts, and a
 * field that mounts after a `reset()` re-initialises from those defaults and
 * discards the reset - so filling the form by resetting it is not reliable
 * when the fields themselves appear and disappear with the selection.
 */
function TaskEditForm({ task, saving, onSave, onDelete }: TaskEditFormProps) {
  // Captured once per mount, so a background refetch cannot overwrite edits.
  const [initialValues] = useState(() => taskToFormValues(task))
  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: taskFormSchema },
    onSubmit: ({ value }) => onSave(value),
  })

  return (
    <Card>
      <CardContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void form.handleSubmit()
                }}
                noValidate
              >
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' }, flexWrap: 'wrap' }}>
                    <form.Field name="title">
                      {(field) => (
                        <TextField
                          label="Title"
                          sx={{ flexGrow: 1, minWidth: '12rem' }}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          onBlur={field.handleBlur}
                          error={field.state.meta.errors.length > 0}
                          helperText={firstErrorMessage(field.state.meta.errors)}
                          slotProps={{ htmlInput: { maxLength: 200 }, formHelperText: { role: 'alert' } }}
                        />
                      )}
                    </form.Field>
                    <form.Field name="status">
                      {(field) => (
                        <TextField
                          select
                          label="Task status"
                          sx={{ minWidth: '9rem' }}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value as Task['status'])}
                          onBlur={field.handleBlur}
                        >
                          <MenuItem value="TODO">To do</MenuItem>
                          <MenuItem value="IN_PROGRESS">In progress</MenuItem>
                          <MenuItem value="DONE">Done</MenuItem>
                        </TextField>
                      )}
                    </form.Field>
                    <form.Field name="priority">
                      {(field) => (
                        <TextField
                          select
                          label="Task priority"
                          sx={{ minWidth: '9rem' }}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value as Task['priority'])}
                          onBlur={field.handleBlur}
                        >
                          <MenuItem value="LOW">Low</MenuItem>
                          <MenuItem value="MEDIUM">Medium</MenuItem>
                          <MenuItem value="HIGH">High</MenuItem>
                        </TextField>
                      )}
                    </form.Field>
                    <form.Field name="assigneeId">
                      {(field) => (
                        <TextField
                          label="Task assignee ID"
                          placeholder="Optional UUID"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          onBlur={field.handleBlur}
                        />
                      )}
                    </form.Field>
                  </Stack>
                  <Stack direction="row" spacing={1.5}>
                    <Button type="submit" variant="contained" disabled={saving}>
                      Save task
                    </Button>
                    <Button type="button" color="error" variant="outlined" onClick={onDelete}>
                      Delete task
                    </Button>
                  </Stack>
                </Stack>
              </form>
      </CardContent>
    </Card>
  )
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
  const [sorting, setSorting] = useState<SortingState>([])

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.list(projectId!, {
      status: filterStatus,
      priority: filterPriority,
      assigneeId: assigneeFilter,
    }),
    queryFn: () => fetchTasks(projectId!, filterStatus, filterPriority, assigneeFilter),
    enabled: !!projectId,
  })
  const tasks = tasksQuery.data?.content ?? []
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null

  const commentsQuery = useQuery({
    queryKey: queryKeys.comments.byTask(selectedTaskId!),
    queryFn: () => request(`/api/tasks/${selectedTaskId}/comments`) as Promise<Comment[]>,
    enabled: !!selectedTaskId,
  })
  const comments = commentsQuery.data ?? []

  const auditQuery = useQuery({
    queryKey: queryKeys.auditEvents.byTask(selectedTaskId!),
    queryFn: () => request(`/api/audit-events?entityType=TASK&entityId=${selectedTaskId}`) as Promise<{ content: AuditEvent[] }>,
    enabled: !!selectedTaskId,
  })
  const auditEvents = auditQuery.data?.content ?? []

  const createForm = useForm({
    defaultValues: EMPTY_TASK_FORM,
    validators: { onSubmit: taskFormSchema },
    onSubmit: ({ value }) => {
      setActionForbidden(false)
      createTaskMutation.mutate(value)
    },
  })
  const commentForm = useForm({
    defaultValues: EMPTY_COMMENT_FORM,
    validators: { onSubmit: commentSchema },
    onSubmit: ({ value }) => {
      setActionForbidden(false)
      addCommentMutation.mutate(value)
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: (values: TaskFormValues) =>
      request(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ ...values, assigneeId: values.assigneeId.trim() || null }),
      }),
    onSuccess: () => {
      createForm.reset()
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projectId!) })
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
      queryClient.setQueriesData<TaskPage>({ queryKey: queryKeys.tasks.byProject(projectId!) }, (old) =>
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
      queryClient.setQueriesData<TaskPage>({ queryKey: queryKeys.tasks.byProject(projectId!) }, (old) =>
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
      queryClient.setQueryData<Comment[]>(queryKeys.comments.byTask(selectedTaskId!), (old) => [comment, ...(old ?? [])])
      commentForm.reset()
      setMessage({ text: 'Comment added', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage({ text: error instanceof Error ? error.message : 'Unable to add comment', tone: 'error' })
    },
  })

  const selectTask = useCallback((task: Task) => {
    setSelectedTaskId(task.id)
    setHasConflict(false)
    setActionForbidden(false)
  }, [])

  async function reloadSelectedTask() {
    if (!selectedTask) return
    try {
      const fresh = (await request(`/api/tasks/${selectedTask.id}`)) as Task
      queryClient.setQueriesData<TaskPage>({ queryKey: queryKeys.tasks.byProject(projectId!) }, (old) =>
        old ? { ...old, content: old.content.map((task) => (task.id === fresh.id ? fresh : task)) } : old)
      setHasConflict(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments.byTask(fresh.id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditEvents.byTask(fresh.id) })
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

  const columns = useMemo(
    () =>
      columnHelper.columns([
      columnHelper.accessor('title', {
        header: 'Title',
        sortFn: 'text',
        cell: (info) => (
          <Link
            component="button"
            type="button"
            underline="hover"
            onClick={() => selectTask(info.row.original)}
            sx={{ fontWeight: 700, textAlign: 'left' }}
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <Chip size="small" variant="outlined" color={STATUS_COLOR[info.getValue()]} label={STATUS_LABEL[info.getValue()]} />
        ),
      }),
      columnHelper.accessor('priority', {
        header: 'Priority',
        cell: (info) => <Chip size="small" variant="outlined" color={PRIORITY_COLOR[info.getValue()]} label={info.getValue()} />,
      }),
      ]),
    [selectTask],
  )

  const table = useTable({
    features: taskTableFeatures,
    data: tasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
  })

  const rows = table.getRowModel().rows
  const virtualize = rows.length > VIRTUALIZE_ABOVE
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: virtualize,
    // Gives the window a sane size before the scroll element is measured, so
    // the first paint (and any non-layout environment) renders rows rather
    // than nothing. Real measurements take over as soon as they arrive.
    initialRect: { width: 0, height: 512 },
  })
  const virtualRows = virtualizer.getVirtualItems()
  const paddingTop = virtualize && virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualize && virtualRows.length > 0 ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0

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
              onSubmit={(event) => {
                event.preventDefault()
                void createForm.handleSubmit()
              }}
              noValidate
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                <createForm.Field name="title">
                  {(field) => (
                    <TextField
                      label="New task"
                      sx={{ flexGrow: 1, minWidth: '12rem' }}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      error={field.state.meta.errors.length > 0}
                      helperText={firstErrorMessage(field.state.meta.errors)}
                      slotProps={{ htmlInput: { maxLength: 200 }, formHelperText: { role: 'alert' } }}
                    />
                  )}
                </createForm.Field>
                <createForm.Field name="status">
                  {(field) => (
                    <TextField
                      select
                      label="Status"
                      sx={{ minWidth: '9rem' }}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value as Task['status'])}
                      onBlur={field.handleBlur}
                    >
                      <MenuItem value="TODO">To do</MenuItem>
                      <MenuItem value="IN_PROGRESS">In progress</MenuItem>
                      <MenuItem value="DONE">Done</MenuItem>
                    </TextField>
                  )}
                </createForm.Field>
                <createForm.Field name="priority">
                  {(field) => (
                    <TextField
                      select
                      label="Priority"
                      sx={{ minWidth: '9rem' }}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value as Task['priority'])}
                      onBlur={field.handleBlur}
                    >
                      <MenuItem value="LOW">Low</MenuItem>
                      <MenuItem value="MEDIUM">Medium</MenuItem>
                      <MenuItem value="HIGH">High</MenuItem>
                    </TextField>
                  )}
                </createForm.Field>
                <createForm.Field name="assigneeId">
                  {(field) => (
                    <TextField
                      label="Assignee ID"
                      placeholder="Optional UUID"
                      sx={{ minWidth: '10rem' }}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                    />
                  )}
                </createForm.Field>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={createTaskMutation.isPending}
                  className="shrink-0 whitespace-nowrap"
                >
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
                <Button type="submit" variant="outlined" className="shrink-0 whitespace-nowrap">
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
          <TableContainer
            component={Card}
            ref={scrollRef}
            sx={virtualize ? { maxHeight: VIRTUAL_VIEWPORT, overflowY: 'auto' } : undefined}
          >
            <Table aria-label="Tasks" stickyHeader={virtualize}>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sorted = header.column.getIsSorted()
                      return (
                        <TableCell key={header.id} sortDirection={sorted === false ? false : sorted}>
                          <TableSortLabel
                            active={sorted !== false}
                            direction={sorted === false ? 'asc' : sorted}
                            onClick={() => header.column.toggleSorting()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </TableSortLabel>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {paddingTop > 0 && (
                  <TableRow style={{ height: paddingTop }}>
                    <TableCell colSpan={3} sx={{ p: 0, border: 0 }} />
                  </TableRow>
                )}
                {(virtualize ? virtualRows.map((virtualRow) => rows[virtualRow.index]) : rows).map((row) => (
                  <TableRow key={row.id} hover selected={row.original.id === selectedTaskId}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {paddingBottom > 0 && (
                  <TableRow style={{ height: paddingBottom }}>
                    <TableCell colSpan={3} sx={{ p: 0, border: 0 }} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {selectedTask && (
          <Stack component="section" aria-labelledby="task-detail-heading" spacing={2}>
            <Divider />
            <Typography variant="h5" component="h2" id="task-detail-heading" sx={{ fontWeight: 700 }}>
              Task details
            </Typography>
            <TaskEditForm
              // Remounting per version gives the form its values through
              // defaultValues, which is the only point TanStack Form reads them.
              key={`${selectedTask.id}-${selectedTask.version}`}
              task={selectedTask}
              saving={updateTaskMutation.isPending}
              onSave={(values) => {
                setActionForbidden(false)
                updateTaskMutation.mutate(values)
              }}
              onDelete={() => setConfirmingDelete(true)}
            />

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
                onSubmit={(event) => {
                  event.preventDefault()
                  void commentForm.handleSubmit()
                }}
                noValidate
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                  <commentForm.Field name="body">
                    {(field) => (
                      <TextField
                        label="Comment"
                        sx={{ flexGrow: 1, minWidth: '12rem' }}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        error={field.state.meta.errors.length > 0}
                        helperText={firstErrorMessage(field.state.meta.errors)}
                        slotProps={{ htmlInput: { maxLength: 4000 }, formHelperText: { role: 'alert' } }}
                      />
                    )}
                  </commentForm.Field>
                  <Button type="submit" variant="contained" disabled={addCommentMutation.isPending} className="shrink-0 whitespace-nowrap">
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
