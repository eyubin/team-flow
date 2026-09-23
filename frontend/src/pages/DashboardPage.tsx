import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { isForbidden, request } from '../lib/api.ts'
import { firstErrorMessage } from '../lib/formError.ts'
import { Forbidden } from '../components/Forbidden.tsx'
import { QueryError } from '../components/QueryError.tsx'
import { StatusMessage, type StatusMessageValue } from '../components/StatusMessage.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

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

const workspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
})

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
})

type WorkspaceValues = z.infer<typeof workspaceSchema>
type ProjectValues = z.infer<typeof projectSchema>

async function fetchWorkspaces() {
  await request('/api/auth/csrf')
  return (await request('/api/workspaces')) as Workspace[]
}

export function DashboardPage() {
  useDocumentTitle('Dashboard')
  const [selectedWorkspace, setSelectedWorkspace] = useState('')
  const [message, setMessage] = useState<StatusMessageValue>(null)
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

  const workspaceForm = useForm({
    defaultValues: { name: '' } as WorkspaceValues,
    validators: { onSubmit: workspaceSchema },
    onSubmit: ({ value }) => {
      setActionForbidden(false)
      createWorkspaceMutation.mutate(value)
    },
  })
  const projectForm = useForm({
    defaultValues: { name: '' } as ProjectValues,
    validators: { onSubmit: projectSchema },
    onSubmit: ({ value }) => {
      setActionForbidden(false)
      createProjectMutation.mutate(value)
    },
  })

  const createWorkspaceMutation = useMutation({
    mutationFn: (values: WorkspaceValues) =>
      request('/api/workspaces', { method: 'POST', body: JSON.stringify(values) }) as Promise<Workspace>,
    onSuccess: (workspace) => {
      workspaceForm.reset()
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setSelectedWorkspace(workspace.id)
      setMessage({ text: 'Workspace created', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage({ text: error instanceof Error ? error.message : 'Unable to create workspace', tone: 'error' })
    },
  })

  const createProjectMutation = useMutation({
    mutationFn: (values: ProjectValues) =>
      request(`/api/workspaces/${activeWorkspace}/projects`, { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      projectForm.reset()
      void queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspace, 'projects'] })
      setMessage({ text: 'Project created', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage({ text: error instanceof Error ? error.message : 'Unable to create project', tone: 'error' })
    },
  })

  const loading = workspacesQuery.isLoading
  const forbidden = isForbidden(workspacesQuery.error) || isForbidden(projectsQuery.error)
  const workspacesFailed = workspacesQuery.isError && !isForbidden(workspacesQuery.error)
  const projectsFailed = projectsQuery.isError && !isForbidden(projectsQuery.error)

  if (loading)
    return (
      <Box component="main">
        <Typography aria-live="polite">Loading dashboard...</Typography>
      </Box>
    )
  if (forbidden) return <Forbidden message="You don't have access to this dashboard." />
  if (workspacesFailed)
    return (
      <Box component="main">
        <QueryError message="We couldn't load your workspaces." onRetry={() => void workspacesQuery.refetch()} />
      </Box>
    )

  return (
    <Box component="main">
      <Stack spacing={4}>
        <Stack spacing={1.5}>
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
            TeamFlow workspace
          </Typography>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
            Project dashboard
          </Typography>
          <Typography component="p" color="text.secondary">
            Create a workspace, then give it a project to hold future tasks.
          </Typography>
        </Stack>

        <Card>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void workspaceForm.handleSubmit()
              }}
              noValidate
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                <workspaceForm.Field name="name">
                  {(field) => (
                    <TextField
                      label="New workspace"
                      fullWidth
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      error={field.state.meta.errors.length > 0}
                      helperText={firstErrorMessage(field.state.meta.errors)}
                      slotProps={{ htmlInput: { maxLength: 120 }, formHelperText: { role: 'alert' } }}
                    />
                  )}
                </workspaceForm.Field>
                <Button type="submit" variant="contained" disabled={createWorkspaceMutation.isPending}>
                  Create workspace
                </Button>
              </Stack>
            </form>
          </CardContent>
        </Card>

        {workspaces.length === 0 ? (
          <Alert severity="info" role="status">No workspaces yet.</Alert>
        ) : (
          <>
            <TextField
              select
              label="Workspace"
              value={activeWorkspace}
              onChange={(event) => setSelectedWorkspace(event.target.value)}
              sx={{ maxWidth: '20rem' }}
            >
              {workspaces.map((workspace) => (
                <MenuItem key={workspace.id} value={workspace.id}>
                  {workspace.name} ({workspace.myRole})
                </MenuItem>
              ))}
            </TextField>

            <Card>
              <CardContent>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void projectForm.handleSubmit()
                  }}
                  noValidate
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                    <projectForm.Field name="name">
                      {(field) => (
                        <TextField
                          label="New project"
                          fullWidth
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          onBlur={field.handleBlur}
                          error={field.state.meta.errors.length > 0}
                          helperText={firstErrorMessage(field.state.meta.errors)}
                          slotProps={{ htmlInput: { maxLength: 120 }, formHelperText: { role: 'alert' } }}
                        />
                      )}
                    </projectForm.Field>
                    <Button type="submit" variant="contained" disabled={createProjectMutation.isPending}>
                      Create project
                    </Button>
                  </Stack>
                </form>
              </CardContent>
            </Card>

            <Stack component="section" aria-labelledby="projects-heading" spacing={1.5}>
              <Typography variant="h5" component="h2" id="projects-heading" sx={{ fontWeight: 700 }}>
                Projects
              </Typography>
              {projectsFailed ? (
                <QueryError message="We couldn't load projects for this workspace." onRetry={() => void projectsQuery.refetch()} />
              ) : projects.length === 0 ? (
                <Alert severity="info" role="status">No projects in this workspace yet.</Alert>
              ) : (
                <Stack spacing={1.5}>
                  {projects.map((project) => (
                    <Card key={project.id}>
                      <CardContent>
                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                          <Stack>
                            <Typography sx={{ fontWeight: 700 }}>{project.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {project.description ?? 'Ready for tasks'}
                            </Typography>
                          </Stack>
                          <Link
                            component={RouterLink}
                            to={`/projects/${project.id}/tasks`}
                            aria-label={`Open task board for ${project.name}`}
                          >
                            Open task board
                          </Link>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>

            <Typography component="p">
              <Link component={RouterLink} to={`/workspaces/${activeWorkspace}/members`}>
                Manage members
              </Link>
            </Typography>
          </>
        )}

        {actionForbidden && (
          <Alert severity="error">
            You don't have permission to do that. This action requires a higher role in this workspace.
          </Alert>
        )}
        <StatusMessage value={message} />
      </Stack>
    </Box>
  )
}
