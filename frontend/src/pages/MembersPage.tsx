import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
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
import { firstErrorMessage } from '../lib/formError.ts'
import { queryKeys } from '../lib/queryKeys.ts'
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

const ROLE_CHIP_COLOR: Record<Member['role'], 'primary' | 'default' | 'warning'> = {
  ADMIN: 'primary',
  MEMBER: 'default',
  VIEWER: 'warning',
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

  const workspacesQuery = useQuery({ queryKey: queryKeys.workspaces.all(), queryFn: fetchWorkspaces })
  const workspace = workspacesQuery.data?.find((item) => item.id === workspaceId)

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId!),
    queryFn: () => request(`/api/workspaces/${workspaceId}/members`) as Promise<Member[]>,
    enabled: !!workspaceId,
  })
  const members = membersQuery.data ?? []

  const memberForm = useForm({
    defaultValues: { email: '', role: 'MEMBER' } as MemberValues,
    validators: { onSubmit: memberSchema },
    onSubmit: ({ value }) => {
      setActionForbidden(false)
      addMemberMutation.mutate(value)
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: (values: MemberValues) =>
      request(`/api/workspaces/${workspaceId}/members`, { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      memberForm.reset()
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId!) })
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId!) })
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId!) })
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

  const columns: GridColDef<Member>[] = [
    {
      field: 'displayName',
      headerName: 'Member',
      flex: 1,
      minWidth: 200,
      sortable: true,
      renderCell: ({ row }) => (
        <Stack sx={{ justifyContent: 'center', height: '100%' }}>
          <Typography sx={{ fontWeight: 700 }}>{row.displayName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {row.email}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 180,
      sortable: true,
      renderCell: ({ row }) =>
        myRole === 'ADMIN' ? (
          <TextField
            select
            size="small"
            value={row.role}
            onChange={(event) => changeRole(row, event.target.value as Member['role'])}
            slotProps={{ select: { 'aria-label': `Role for ${row.displayName}` } }}
            sx={{ my: 1.5 }}
          >
            <MenuItem value="ADMIN">Admin</MenuItem>
            <MenuItem value="MEMBER">Member</MenuItem>
            <MenuItem value="VIEWER">Viewer</MenuItem>
          </TextField>
        ) : (
          <Chip size="small" color={ROLE_CHIP_COLOR[row.role]} label={row.role} />
        ),
    },
    ...(myRole === 'ADMIN'
      ? [
          {
            field: 'actions',
            headerName: '',
            width: 120,
            sortable: false,
            renderCell: ({ row }: { row: Member }) => (
              <Button
                type="button"
                color="error"
                variant="outlined"
                size="small"
                onClick={() => setMemberPendingRemoval(row)}
              >
                Remove
              </Button>
            ),
          } satisfies GridColDef<Member>,
        ]
      : []),
  ]

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
            <DataGrid
              rows={members}
              columns={columns}
              getRowId={(row: Member) => row.userId}
              getRowHeight={() => 64}
              autoHeight
              hideFooter
              disableColumnMenu
              disableRowSelectionOnClick
              // Workspace member lists are small, and turning virtualisation off
              // keeps every row in the DOM for assistive tech and for tests.
              disableVirtualization
              aria-label="Workspace members"
            />
          )}
          {myRole === 'ADMIN' && (
            <Card>
              <CardContent>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void memberForm.handleSubmit()
                  }}
                  noValidate
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                    <memberForm.Field name="email">
                      {(field) => (
                        <TextField
                          label="Email"
                          type="email"
                          fullWidth
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                          onBlur={field.handleBlur}
                          error={field.state.meta.errors.length > 0}
                          helperText={firstErrorMessage(field.state.meta.errors)}
                          slotProps={{ formHelperText: { role: 'alert' } }}
                        />
                      )}
                    </memberForm.Field>
                    <memberForm.Field name="role">
                      {(field) => (
                        <TextField
                          select
                          label="Role"
                          sx={{ minWidth: '10rem' }}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value as MemberValues['role'])}
                          onBlur={field.handleBlur}
                        >
                          <MenuItem value="MEMBER">Member</MenuItem>
                          <MenuItem value="VIEWER">Viewer</MenuItem>
                          <MenuItem value="ADMIN">Admin</MenuItem>
                        </TextField>
                      )}
                    </memberForm.Field>
                    <Button type="submit" variant="contained" disabled={addMemberMutation.isPending} className="shrink-0 whitespace-nowrap">
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
