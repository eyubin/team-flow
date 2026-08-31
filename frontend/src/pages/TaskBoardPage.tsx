import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Link,
  Select,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons'
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

const STATUS_LABEL: Record<Task['status'], string> = { TODO: 'To do', IN_PROGRESS: 'In progress', DONE: 'Done' }
const PRIORITY_COLOR: Record<Task['priority'], 'gray' | 'amber' | 'red'> = { LOW: 'gray', MEDIUM: 'amber', HIGH: 'red' }
const STATUS_COLOR: Record<Task['status'], 'gray' | 'iris' | 'green'> = { TODO: 'gray', IN_PROGRESS: 'iris', DONE: 'green' }

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

  function confirmDeleteSelectedTask() {
    setActionForbidden(false)
    setConfirmingDelete(false)
    deleteTaskMutation.mutate()
  }

  const loading = tasksQuery.isLoading
  const forbidden = isForbidden(tasksQuery.error)

  if (loading)
    return (
      <Box asChild>
        <main>
          <Text>Loading tasks...</Text>
        </main>
      </Box>
    )
  if (forbidden) return <Forbidden message="You don't have access to this project's task board." />

  return (
    <Box asChild>
      <main>
        <Flex direction="column" gap="6">
          <Flex direction="column" gap="3">
            <Text size="1" color="iris" weight="bold" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              TeamFlow project
            </Text>
            <Heading as="h1" size="8">
              Task board
            </Heading>
          </Flex>

          <Card size="3">
            <form
              onSubmit={createForm.handleSubmit((values) => {
                setActionForbidden(false)
                createTaskMutation.mutate(values)
              })}
              noValidate
            >
              <Flex direction={{ initial: 'column', sm: 'row' }} align={{ initial: 'stretch', sm: 'end' }} gap="3" wrap="wrap">
                <Flex asChild direction="column" gap="1" flexGrow="1" minWidth="12rem">
                  <label>
                    <Text weight="medium" size="2">
                      New task
                    </Text>
                    <TextField.Root {...createForm.register('title')} maxLength={200} aria-invalid={!!createForm.formState.errors.title} />
                    {createForm.formState.errors.title && (
                      <Text role="alert" color="red" size="1">
                        {createForm.formState.errors.title.message}
                      </Text>
                    )}
                  </label>
                </Flex>
                <Flex asChild direction="column" gap="1">
                  <label>
                    <Text weight="medium" size="2">
                      Status
                    </Text>
                    <Controller
                      name="status"
                      control={createForm.control}
                      render={({ field }) => (
                        <Select.Root value={field.value} onValueChange={field.onChange}>
                          <Select.Trigger aria-label="Status" />
                          <Select.Content>
                            <Select.Item value="TODO">To do</Select.Item>
                            <Select.Item value="IN_PROGRESS">In progress</Select.Item>
                            <Select.Item value="DONE">Done</Select.Item>
                          </Select.Content>
                        </Select.Root>
                      )}
                    />
                  </label>
                </Flex>
                <Flex asChild direction="column" gap="1">
                  <label>
                    <Text weight="medium" size="2">
                      Priority
                    </Text>
                    <Controller
                      name="priority"
                      control={createForm.control}
                      render={({ field }) => (
                        <Select.Root value={field.value} onValueChange={field.onChange}>
                          <Select.Trigger aria-label="Priority" />
                          <Select.Content>
                            <Select.Item value="LOW">Low</Select.Item>
                            <Select.Item value="MEDIUM">Medium</Select.Item>
                            <Select.Item value="HIGH">High</Select.Item>
                          </Select.Content>
                        </Select.Root>
                      )}
                    />
                  </label>
                </Flex>
                <Flex asChild direction="column" gap="1">
                  <label>
                    <Text weight="medium" size="2">
                      Assignee ID
                    </Text>
                    <TextField.Root {...createForm.register('assigneeId')} placeholder="Optional UUID" />
                  </label>
                </Flex>
                <Button type="submit" disabled={createTaskMutation.isPending}>
                  Create task
                </Button>
              </Flex>
            </form>
          </Card>

          <Card size="2" variant="surface">
            <form onSubmit={(event) => { event.preventDefault(); void tasksQuery.refetch() }}>
              <Flex direction={{ initial: 'column', sm: 'row' }} align={{ initial: 'stretch', sm: 'end' }} gap="3" wrap="wrap">
                <Flex asChild direction="column" gap="1">
                  <label>
                    <Text weight="medium" size="2">
                      Filter status
                    </Text>
                    <Select.Root
                      value={filterStatus || 'ALL'}
                      onValueChange={(value) => setFilterStatus(value === 'ALL' ? '' : (value as Task['status']))}
                    >
                      <Select.Trigger aria-label="Filter status" />
                      <Select.Content>
                        <Select.Item value="ALL">All statuses</Select.Item>
                        <Select.Item value="TODO">To do</Select.Item>
                        <Select.Item value="IN_PROGRESS">In progress</Select.Item>
                        <Select.Item value="DONE">Done</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </label>
                </Flex>
                <Flex asChild direction="column" gap="1">
                  <label>
                    <Text weight="medium" size="2">
                      Filter priority
                    </Text>
                    <Select.Root
                      value={filterPriority || 'ALL'}
                      onValueChange={(value) => setFilterPriority(value === 'ALL' ? '' : (value as Task['priority']))}
                    >
                      <Select.Trigger aria-label="Filter priority" />
                      <Select.Content>
                        <Select.Item value="ALL">All priorities</Select.Item>
                        <Select.Item value="LOW">Low</Select.Item>
                        <Select.Item value="MEDIUM">Medium</Select.Item>
                        <Select.Item value="HIGH">High</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </label>
                </Flex>
                <Flex asChild direction="column" gap="1">
                  <label>
                    <Text weight="medium" size="2">
                      Filter by assignee ID
                    </Text>
                    <TextField.Root
                      value={assigneeFilter}
                      onChange={(event) => setAssigneeFilter(event.target.value)}
                      placeholder="Optional UUID"
                    />
                  </label>
                </Flex>
                <Button type="submit" variant="soft">
                  Apply filters
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setFilterStatus(''); setFilterPriority(''); setAssigneeFilter(''); }}
                >
                  Clear
                </Button>
              </Flex>
            </form>
          </Card>

          {tasks.length === 0 ? (
            <Callout.Root color="gray">
              <Callout.Icon>
                <InfoCircledIcon />
              </Callout.Icon>
              <Callout.Text>No tasks in this project yet.</Callout.Text>
            </Callout.Root>
          ) : (
            <Flex direction="column" gap="3">
              {tasks.map((task) => (
                <Card key={task.id} asChild variant={task.id === selectedTaskId ? 'classic' : 'surface'}>
                  <button type="button" onClick={() => selectTask(task)} style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                    <Flex direction="column" gap="2">
                      <Text weight="bold">{task.title}</Text>
                      <Flex gap="2">
                        <Badge color={STATUS_COLOR[task.status]} variant="soft">
                          {STATUS_LABEL[task.status]}
                        </Badge>
                        <Badge color={PRIORITY_COLOR[task.priority]} variant="soft">
                          {task.priority}
                        </Badge>
                      </Flex>
                    </Flex>
                  </button>
                </Card>
              ))}
            </Flex>
          )}

          {selectedTask && (
            <Flex direction="column" gap="4" asChild>
              <section aria-labelledby="task-detail-heading">
                <Separator size="4" />
                <Heading as="h2" size="6" id="task-detail-heading">
                  Task details
                </Heading>
                <Card size="3">
                  <form
                    onSubmit={editForm.handleSubmit((values) => {
                      setActionForbidden(false)
                      updateTaskMutation.mutate(values)
                    })}
                    noValidate
                  >
                    <Flex direction="column" gap="3">
                      <Flex direction={{ initial: 'column', sm: 'row' }} align={{ initial: 'stretch', sm: 'end' }} gap="3" wrap="wrap">
                        <Flex asChild direction="column" gap="1" flexGrow="1" minWidth="12rem">
                          <label>
                            <Text weight="medium" size="2">
                              Title
                            </Text>
                            <TextField.Root {...editForm.register('title')} maxLength={200} aria-invalid={!!editForm.formState.errors.title} />
                          </label>
                        </Flex>
                        <Flex asChild direction="column" gap="1">
                          <label>
                            <Text weight="medium" size="2">
                              Status
                            </Text>
                            <Controller
                              name="status"
                              control={editForm.control}
                              render={({ field }) => (
                                <Select.Root value={field.value} onValueChange={field.onChange}>
                                  <Select.Trigger aria-label="Task status" />
                                  <Select.Content>
                                    <Select.Item value="TODO">To do</Select.Item>
                                    <Select.Item value="IN_PROGRESS">In progress</Select.Item>
                                    <Select.Item value="DONE">Done</Select.Item>
                                  </Select.Content>
                                </Select.Root>
                              )}
                            />
                          </label>
                        </Flex>
                        <Flex asChild direction="column" gap="1">
                          <label>
                            <Text weight="medium" size="2">
                              Priority
                            </Text>
                            <Controller
                              name="priority"
                              control={editForm.control}
                              render={({ field }) => (
                                <Select.Root value={field.value} onValueChange={field.onChange}>
                                  <Select.Trigger aria-label="Task priority" />
                                  <Select.Content>
                                    <Select.Item value="LOW">Low</Select.Item>
                                    <Select.Item value="MEDIUM">Medium</Select.Item>
                                    <Select.Item value="HIGH">High</Select.Item>
                                  </Select.Content>
                                </Select.Root>
                              )}
                            />
                          </label>
                        </Flex>
                        <Flex asChild direction="column" gap="1">
                          <label>
                            <Text weight="medium" size="2">
                              Task assignee ID
                            </Text>
                            <TextField.Root {...editForm.register('assigneeId')} placeholder="Optional UUID" />
                          </label>
                        </Flex>
                      </Flex>
                      <Flex gap="3">
                        <Button type="submit" disabled={updateTaskMutation.isPending}>
                          Save task
                        </Button>
                        <Button type="button" color="red" variant="soft" onClick={() => setConfirmingDelete(true)}>
                          Delete task
                        </Button>
                      </Flex>
                    </Flex>
                  </form>
                </Card>

                {hasConflict && (
                  <Callout.Root color="amber" role="alert">
                    <Callout.Icon>
                      <ExclamationTriangleIcon />
                    </Callout.Icon>
                    <Callout.Text>
                      This task has changed on the server.{' '}
                      <Link asChild>
                        <button type="button" onClick={reloadSelectedTask} style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline' }}>
                          Reload task
                        </button>
                      </Link>
                    </Callout.Text>
                  </Callout.Root>
                )}

                <Flex direction="column" gap="3">
                  <Heading as="h3" size="4">
                    Comments
                  </Heading>
                  <form
                    onSubmit={commentForm.handleSubmit((values) => {
                      setActionForbidden(false)
                      addCommentMutation.mutate(values)
                    })}
                    noValidate
                  >
                    <Flex direction={{ initial: 'column', sm: 'row' }} align={{ initial: 'stretch', sm: 'end' }} gap="3" wrap="wrap">
                      <Flex asChild direction="column" gap="1" flexGrow="1" minWidth="12rem">
                        <label>
                          <Text weight="medium" size="2">
                            Comment
                          </Text>
                          <TextField.Root {...commentForm.register('body')} maxLength={4000} aria-invalid={!!commentForm.formState.errors.body} />
                        </label>
                      </Flex>
                      <Button type="submit" disabled={addCommentMutation.isPending}>
                        Add comment
                      </Button>
                    </Flex>
                  </form>
                  {comments.length === 0 ? (
                    <Callout.Root color="gray" size="1">
                      <Callout.Text>No comments yet.</Callout.Text>
                    </Callout.Root>
                  ) : (
                    <Flex direction="column" gap="2">
                      {comments.map((comment) => (
                        <Card key={comment.id} size="1" variant="surface">
                          <Text as="p" size="2">
                            {comment.body}
                          </Text>
                        </Card>
                      ))}
                    </Flex>
                  )}
                </Flex>

                <Flex direction="column" gap="3">
                  <Heading as="h3" size="4">
                    History
                  </Heading>
                  {auditEvents.length === 0 ? (
                    <Callout.Root color="gray" size="1">
                      <Callout.Text>No history yet.</Callout.Text>
                    </Callout.Root>
                  ) : (
                    <Flex direction="column" gap="1">
                      {auditEvents.map((event) => (
                        <Text as="p" key={event.id} size="2" color="gray">
                          {event.action}
                        </Text>
                      ))}
                    </Flex>
                  )}
                </Flex>
              </section>
            </Flex>
          )}

          {actionForbidden && (
            <Callout.Root color="red" role="alert">
              <Callout.Icon>
                <InfoCircledIcon />
              </Callout.Icon>
              <Callout.Text>You don't have permission to do that. Your role in this project is read-only.</Callout.Text>
            </Callout.Root>
          )}
          <Text aria-live="polite" color="gray" size="2">
            {message}
          </Text>
          <Text as="p">
            <Link href="/dashboard">Back to dashboard</Link>
          </Text>
        </Flex>

        <AlertDialog.Root open={confirmingDelete} onOpenChange={setConfirmingDelete}>
          <AlertDialog.Content maxWidth="26rem">
            <AlertDialog.Title>Delete task</AlertDialog.Title>
            <AlertDialog.Description>
              Delete {selectedTask?.title}? This can't be undone.
            </AlertDialog.Description>
            <Flex gap="3" mt="4" justify="end">
              <AlertDialog.Cancel>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action>
                <Button color="red" onClick={confirmDeleteSelectedTask}>
                  Delete
                </Button>
              </AlertDialog.Action>
            </Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </main>
    </Box>
  )
}
