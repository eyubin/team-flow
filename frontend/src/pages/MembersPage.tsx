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
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { InfoCircledIcon } from '@radix-ui/react-icons'
import { isForbidden, request } from '../lib/api.ts'
import { Forbidden } from '../components/Forbidden.tsx'

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
  const [message, setMessage] = useState('')
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
      setMessage('Member added')
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to add member')
    },
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ member, role }: { member: Member; role: Member['role'] }) =>
      request(`/api/workspaces/${workspaceId}/members/${member.userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'members'] })
      setMessage('Member role updated')
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to update role')
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (member: Member) =>
      request(`/api/workspaces/${workspaceId}/members/${member.userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'members'] })
      setMessage('Member removed')
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) setActionForbidden(true)
      setMessage(error instanceof Error ? error.message : 'Unable to remove member')
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

  if (loading)
    return (
      <Box asChild>
        <main>
          <Text aria-live="polite">Loading members...</Text>
        </main>
      </Box>
    )
  if (forbidden) return <Forbidden message="You don't have access to this workspace's members." />

  const myRole = workspace?.myRole

  return (
    <Box asChild>
      <main>
        <Flex direction="column" gap="6">
          <Flex direction="column" gap="3">
            <Text size="1" color="iris" weight="bold" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              TeamFlow workspace
            </Text>
            <Heading as="h1" size="8">
              Members{workspace ? ` – ${workspace.name}` : ''}
            </Heading>
          </Flex>

          <Flex direction="column" gap="3" asChild>
            <section aria-labelledby="members-heading">
              <Heading as="h2" size="5" id="members-heading">
                Members
              </Heading>
              {members.length === 0 ? (
                <Callout.Root color="gray">
                  <Callout.Icon>
                    <InfoCircledIcon />
                  </Callout.Icon>
                  <Callout.Text>No members found.</Callout.Text>
                </Callout.Root>
              ) : (
                <Box overflowX="auto">
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
                            <Flex direction="column">
                              <Text weight="bold">{member.displayName}</Text>
                              <Text color="gray" size="1">
                                {member.email}
                              </Text>
                            </Flex>
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
                                color="red"
                                variant="soft"
                                size="1"
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
                <Card size="3">
                  <form
                    onSubmit={memberForm.handleSubmit((values) => {
                      setActionForbidden(false)
                      addMemberMutation.mutate(values)
                    })}
                    noValidate
                  >
                    <Flex direction={{ initial: 'column', sm: 'row' }} align={{ initial: 'stretch', sm: 'end' }} gap="3" wrap="wrap">
                      <Flex asChild direction="column" gap="1" flexGrow="1" minWidth="12rem">
                        <label>
                          <Text weight="medium" size="2">
                            Email
                          </Text>
                          <TextField.Root
                            type="email"
                            {...memberForm.register('email')}
                            aria-invalid={!!memberForm.formState.errors.email}
                          />
                          {memberForm.formState.errors.email && (
                            <Text role="alert" color="red" size="1">
                              {memberForm.formState.errors.email.message}
                            </Text>
                          )}
                        </label>
                      </Flex>
                      <Flex asChild direction="column" gap="1">
                        <label>
                          <Text weight="medium" size="2">
                            Role
                          </Text>
                          <Controller
                            name="role"
                            control={memberForm.control}
                            render={({ field }) => (
                              <Select.Root value={field.value} onValueChange={field.onChange}>
                                <Select.Trigger aria-label="Role" />
                                <Select.Content>
                                  <Select.Item value="MEMBER">Member</Select.Item>
                                  <Select.Item value="VIEWER">Viewer</Select.Item>
                                  <Select.Item value="ADMIN">Admin</Select.Item>
                                </Select.Content>
                              </Select.Root>
                            )}
                          />
                        </label>
                      </Flex>
                      <Button type="submit" disabled={addMemberMutation.isPending}>
                        Add member
                      </Button>
                    </Flex>
                  </form>
                </Card>
              )}
            </section>
          </Flex>

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
          <Text as="p">
            <Link href="/dashboard">Back to dashboard</Link>
          </Text>
        </Flex>

        <AlertDialog.Root open={!!memberPendingRemoval} onOpenChange={(open) => !open && setMemberPendingRemoval(null)}>
          <AlertDialog.Content maxWidth="26rem">
            <AlertDialog.Title>Remove member</AlertDialog.Title>
            <AlertDialog.Description>
              Remove {memberPendingRemoval?.displayName} from this workspace? They will lose access immediately.
            </AlertDialog.Description>
            <Flex gap="3" mt="4" justify="end">
              <AlertDialog.Cancel>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action>
                <Button color="red" onClick={confirmRemoveMember}>
                  Remove
                </Button>
              </AlertDialog.Action>
            </Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </main>
    </Box>
  )
}
