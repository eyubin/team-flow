import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
// The members table still renders with Radix primitives; it is replaced
// wholesale by the MUI X DataGrid in the next step, so it is not worth
// rebuilding here only to delete it.
import { Badge, Select, Table } from '@radix-ui/themes'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { isForbidden, request } from '../lib/api.ts'
import { Forbidden } from '../components/Forbidden.tsx'
import { QueryError } from '../components/QueryError.tsx'
import { StatusMessage, type StatusMessageValue } from '../components/StatusMessage.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

type Workspace = {
  id: string
  name: string
  myRole: string
}

type Member = {
  userId: string
  email: string
  displayName: string
  role: 'ADMIN' | 'MEMBER' | 'VIEWER'
}

const memberSchema = z.object({
  email: z.string().min(1, 'Email is required').max(320).email('Enter a valid email address'),
  role: z.enum(['MEMBER', 'VIEWER', 'ADMIN']),
})

type MemberValues = z.infer<typeof memberSchema>

const ROLE_BADGE_COLOR: Record<Member['role'], 'iris' | 'gray' | 'amber'> = {
  ADMIN: 'iris',
  MEMBER: 'gray',
  VIEWER: 'amber',
}

async function fetchWorkspaces() {
  await request('/api/auth/csrf')
  return (await request('/api/workspaces')) as Workspace[]
}

export function MembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  useDocumentTitle('Members')
  const [message, setMessage] = useState<StatusMessageValue>(null)
  const [actionForbidden, setActionForbidden] = useState(false)
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<Member | null>(null)
  const queryClient = useQueryClient()

  const workspacesQuery = useQuery({ queryKey: ['workspaces'], queryFn: fetchWorkspaces })
  const workspace = workspacesQuery.data?.find((item) => item.id === workspaceId)

  const membersQuery = useQuery({
    queryKey: ['workspaces', workspaceId, 'members'],
    queryFn: () => request(`/api/workspaces/${workspaceId}/members`) as Promise<Member[]>,
    enabled: !!workspaceId,
  })
  const members = membersQuery.data ?? []

  const memberForm = useForm<MemberValues>({ resolver: zodResolver(memberSchema), defaultValues: { email: '', role: 'MEMBER' } })

  const addMemberMutation = useMutation({
    mutationFn: (values: MemberValues) =>
      request(`/api/workspaces/${workspaceId}/members`, { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      memberForm.reset()
      void queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'members'] })
      setMessage({ text: 'Member added', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage({ text: error instanceof Error ? error.message : 'Unable to add member', tone: 'error' })
    },
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ member, role }: { member: Member; role: Member['role'] }) =>
      request(`/api/workspaces/${workspaceId}/members/${member.userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'members'] })
      setMessage({ text: 'Member role updated', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage({ text: error instanceof Error ? error.message : 'Unable to update role', tone: 'error' })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (member: Member) =>
      request(`/api/workspaces/${workspaceId}/members/${member.userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'members'] })
      setMessage({ text: 'Member removed', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage({ text: error instanceof Error ? error.message : 'Unable to remove member', tone: 'error' })
    },
  })

  function changeRole(member: Member, role: Member['role']) {
    if (!workspaceId || role === member.role) return
    setActionForbidden(false)
    changeRoleMutation.mutate({ member, role })
  }

  function confirmRemoveMember() {
    if (!workspaceId || !memberPendingRemoval) return
    setActionForbidden(false)
    removeMemberMutation.mutate(memberPendingRemoval)
    setMemberPendingRemoval(null)
  }

  const loading = workspacesQuery.isLoading || membersQuery.isLoading
  const forbidden = isForbidden(workspacesQuery.error) || isForbidden(membersQuery.error)
  const failed = (workspacesQuery.isError && !isForbidden(workspacesQuery.error)) ||
    (membersQuery.isError && !isForbidden(membersQuery.error))

  if (loading)
    return (
      <Box component="main">
        <Typography aria-live="polite">Loading members...</Typography>
      </Box>
    )
  if (forbidden) return <Forbidden message="You don't have access to this workspace's members." />
  if (failed)
    return (
      <Box component="main">
        <QueryError
          message="We couldn't load this workspace's members."
          onRetry={() => {
            void workspacesQuery.refetch()
            void membersQuery.refetch()
          }}
        />
      </Box>
    )

  const myRole = workspace?.myRole

  return (
    <Box component="main">
      <Stack spacing={4}>
        <Stack spacing={1.5}>
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
            TeamFlow workspace
          </Typography>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
            Members{workspace ? ` – ${workspace.name}` : ''}
          </Typography>
        </Stack>

        <Stack component="section" aria-labelledby="members-heading" spacing={1.5}>
          <Typography variant="h5" component="h2" id="members-heading" sx={{ fontWeight: 700 }}>
            Members
          </Typography>
          {members.length === 0 ? (
            <Alert severity="info" role="status">
              No members found.
            </Alert>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
                  <Table.Root variant="surface">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Member</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
                        {myRole === 'ADMIN' && <Table.ColumnHeaderCell></Table.ColumnHeaderCell>}
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {members.map((member) => (
                        <Table.Row key={member.userId}>
                          <Table.RowHeaderCell>
                            <Stack>
                              <Typography sx={{ fontWeight: 700 }}>{member.displayName}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {member.email}
                              </Typography>
                            </Stack>
                          </Table.RowHeaderCell>
                          <Table.Cell>
                            {myRole === 'ADMIN' ? (
                              <Select.Root
                                value={member.role}
                                onValueChange={(value) => changeRole(member, value as Member['role'])}
                              >
                                <Select.Trigger aria-label={`Role for ${member.displayName}`} />
                                <Select.Content>
                                  <Select.Item value="ADMIN">Admin</Select.Item>
                                  <Select.Item value="MEMBER">Member</Select.Item>
                                  <Select.Item value="VIEWER">Viewer</Select.Item>
                                </Select.Content>
                              </Select.Root>
                            ) : (
                              <Badge color={ROLE_BADGE_COLOR[member.role]} variant="soft">
                                {member.role}
                              </Badge>
                            )}
                          </Table.Cell>
                          {myRole === 'ADMIN' && (
                            <Table.Cell>
                              <Button
                                type="button"
                                color="error"
                                variant="outlined"
                                size="small"
                                onClick={() => setMemberPendingRemoval(member)}
                              >
                                Remove
                              </Button>
                            </Table.Cell>
                          )}
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Box>
              )}
          {myRole === 'ADMIN' && (
            <Card>
              <CardContent>
                <form
                  onSubmit={memberForm.handleSubmit((values) => {
                    setActionForbidden(false)
                    addMemberMutation.mutate(values)
                  })}
                  noValidate
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                    <TextField
                      label="Email"
                      type="email"
                      fullWidth
                      error={!!memberForm.formState.errors.email}
                      helperText={memberForm.formState.errors.email?.message}
                      slotProps={{ formHelperText: { role: 'alert' } }}
                      {...memberForm.register('email')}
                    />
                    <Controller
                      name="role"
                      control={memberForm.control}
                      render={({ field }) => (
                        <TextField select label="Role" sx={{ minWidth: '10rem' }} {...field}>
                          <MenuItem value="MEMBER">Member</MenuItem>
                          <MenuItem value="VIEWER">Viewer</MenuItem>
                          <MenuItem value="ADMIN">Admin</MenuItem>
                        </TextField>
                      )}
                    />
                    <Button type="submit" variant="contained" disabled={addMemberMutation.isPending}>
                      Add member
                    </Button>
                  </Stack>
                </form>
              </CardContent>
            </Card>
          )}
        </Stack>

        {actionForbidden && (
          <Alert severity="error">
            You don't have permission to do that. This action requires a higher role in this workspace.
          </Alert>
        )}
        <StatusMessage value={message} />
        <Typography component="p">
          <Link component={RouterLink} to="/dashboard">
            Back to dashboard
          </Link>
        </Typography>
      </Stack>

      <Dialog
        open={!!memberPendingRemoval}
        onClose={() => setMemberPendingRemoval(null)}
        slotProps={{ paper: { role: 'alertdialog', sx: { maxWidth: '26rem' } } }}
        aria-labelledby="remove-member-title"
        aria-describedby="remove-member-description"
      >
        <DialogTitle id="remove-member-title">Remove member</DialogTitle>
        <DialogContent>
          <DialogContentText id="remove-member-description">
            Remove {memberPendingRemoval?.displayName} from this workspace? They will lose access immediately.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setMemberPendingRemoval(null)}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={confirmRemoveMember}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
