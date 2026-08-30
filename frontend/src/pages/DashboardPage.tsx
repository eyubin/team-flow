import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, Callout, Card, Flex, Heading, Link, Select, Text, TextField } from '@radix-ui/themes'
import { InfoCircledIcon } from '@radix-ui/react-icons'
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

  const workspaceForm = useForm<WorkspaceValues>({ resolver: zodResolver(workspaceSchema), defaultValues: { name: '' } })
  const projectForm = useForm<ProjectValues>({ resolver: zodResolver(projectSchema), defaultValues: { name: '' } })

  const createWorkspaceMutation = useMutation({
    mutationFn: (values: WorkspaceValues) =>
      request('/api/workspaces', { method: 'POST', body: JSON.stringify(values) }) as Promise<Workspace>,
    onSuccess: (workspace) => {
      workspaceForm.reset()
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setSelectedWorkspace(workspace.id)
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

  const loading = workspacesQuery.isLoading
  const forbidden = isForbidden(workspacesQuery.error) || isForbidden(projectsQuery.error)

  if (loading)
    return (
      <Box asChild>
        <main>
          <Text aria-live="polite">Loading dashboard...</Text>
        </main>
      </Box>
    )
  if (forbidden) return <Forbidden message="You don't have access to this dashboard." />

  return (
    <Box asChild>
      <main>
        <Flex direction="column" gap="6">
          <Flex direction="column" gap="3">
            <Text size="1" color="iris" weight="bold" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              TeamFlow workspace
            </Text>
            <Heading as="h1" size="8">
              Project dashboard
            </Heading>
            <Text as="p" color="gray">
              Create a workspace, then give it a project to hold future tasks.
            </Text>
          </Flex>

          <Card size="3">
            <form
              onSubmit={workspaceForm.handleSubmit((values) => {
                setActionForbidden(false)
                createWorkspaceMutation.mutate(values)
              })}
              noValidate
            >
              <Flex direction={{ initial: 'column', sm: 'row' }} align={{ initial: 'stretch', sm: 'end' }} gap="3" wrap="wrap">
                <Flex asChild direction="column" gap="1" flexGrow="1" minWidth="12rem">
                  <label>
                    <Text weight="medium" size="2">
                      New workspace
                    </Text>
                    <TextField.Root
                      {...workspaceForm.register('name')}
                      maxLength={120}
                      aria-invalid={!!workspaceForm.formState.errors.name}
                    />
                    {workspaceForm.formState.errors.name && (
                      <Text role="alert" color="red" size="1">
                        {workspaceForm.formState.errors.name.message}
                      </Text>
                    )}
                  </label>
                </Flex>
                <Button type="submit" disabled={createWorkspaceMutation.isPending}>
                  Create workspace
                </Button>
              </Flex>
            </form>
          </Card>

          {workspaces.length === 0 ? (
            <Callout.Root color="gray">
              <Callout.Icon>
                <InfoCircledIcon />
              </Callout.Icon>
              <Callout.Text>No workspaces yet.</Callout.Text>
            </Callout.Root>
          ) : (
            <>
              <Flex asChild direction="column" gap="1" maxWidth="20rem">
                <label>
                  <Text weight="medium" size="2">
                    Workspace
                  </Text>
                  <Select.Root value={activeWorkspace} onValueChange={setSelectedWorkspace}>
                    <Select.Trigger aria-label="Workspace" />
                    <Select.Content>
                      {workspaces.map((workspace) => (
                        <Select.Item key={workspace.id} value={workspace.id}>
                          {workspace.name} ({workspace.myRole})
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </label>
              </Flex>

              <Card size="3">
                <form
                  onSubmit={projectForm.handleSubmit((values) => {
                    setActionForbidden(false)
                    createProjectMutation.mutate(values)
                  })}
                  noValidate
                >
                  <Flex direction={{ initial: 'column', sm: 'row' }} align={{ initial: 'stretch', sm: 'end' }} gap="3" wrap="wrap">
                    <Flex asChild direction="column" gap="1" flexGrow="1" minWidth="12rem">
                      <label>
                        <Text weight="medium" size="2">
                          New project
                        </Text>
                        <TextField.Root
                          {...projectForm.register('name')}
                          maxLength={120}
                          aria-invalid={!!projectForm.formState.errors.name}
                        />
                        {projectForm.formState.errors.name && (
                          <Text role="alert" color="red" size="1">
                            {projectForm.formState.errors.name.message}
                          </Text>
                        )}
                      </label>
                    </Flex>
                    <Button type="submit" disabled={createProjectMutation.isPending}>
                      Create project
                    </Button>
                  </Flex>
                </form>
              </Card>

              <Flex direction="column" gap="3" asChild>
                <section aria-labelledby="projects-heading">
                  <Heading as="h2" size="5" id="projects-heading">
                    Projects
                  </Heading>
                  {projects.length === 0 ? (
                    <Callout.Root color="gray">
                      <Callout.Icon>
                        <InfoCircledIcon />
                      </Callout.Icon>
                      <Callout.Text>No projects in this workspace yet.</Callout.Text>
                    </Callout.Root>
                  ) : (
                    <Flex direction="column" gap="3">
                      {projects.map((project) => (
                        <Card key={project.id}>
                          <Flex justify="between" align="center" gap="3" wrap="wrap">
                            <Flex direction="column">
                              <Text weight="bold">{project.name}</Text>
                              <Text color="gray" size="2">
                                {project.description ?? 'Ready for tasks'}
                              </Text>
                            </Flex>
                            <Link href={`/projects/${project.id}/tasks`} aria-label={`Open task board for ${project.name}`}>
                              Open task board
                            </Link>
                          </Flex>
                        </Card>
                      ))}
                    </Flex>
                  )}
                </section>
              </Flex>

              <Text as="p">
                <Link href={`/workspaces/${activeWorkspace}/members`}>Manage members</Link>
              </Text>
            </>
          )}

          {actionForbidden && (
            <Callout.Root color="red" role="alert">
              <Callout.Icon>
                <InfoCircledIcon />
              </Callout.Icon>
              <Callout.Text>
                You don't have permission to do that. This action requires a higher role in this workspace.
              </Callout.Text>
            </Callout.Root>
          )}
          <Text aria-live="polite" color="gray" size="2">
            {message}
          </Text>
        </Flex>
      </main>
    </Box>
  )
}
