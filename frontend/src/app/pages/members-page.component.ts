import { ChangeDetectionStrategy, Component, type TemplateRef, computed, inject, input, signal, viewChild } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog'
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { MatOption, MatSelect } from '@angular/material/select'
import { MatSort, MatSortHeader, type Sort } from '@angular/material/sort'
import { MatTableModule } from '@angular/material/table'
import { RouterLink } from '@angular/router'
import { QueryClient, injectMutation, injectQuery } from '@tanstack/angular-query-experimental'
import { AlertComponent } from '../components/alert.component'
import { BadgeComponent, type BadgeTone } from '../components/badge.component'
import { ForbiddenComponent } from '../components/forbidden.component'
import { QueryErrorComponent } from '../components/query-error.component'
import { StatusMessageComponent, type StatusMessageValue } from '../components/status-message.component'
import { isForbidden, request } from '../lib/api'
import { injectDocumentTitle } from '../lib/document-title'
import { errorMessage, submitForm } from '../lib/form-validation'
import { queryKeys } from '../lib/query-keys'
import { sortRows } from '../lib/sort'

type Workspace = {
  id: string
  name: string
  myRole: string
}

type Role = 'ADMIN' | 'MEMBER' | 'VIEWER'

type Member = {
  userId: string
  email: string
  displayName: string
  role: Role
}

const EMAIL_MESSAGES = { required: 'Email is required', email: 'Enter a valid email address' }

type MemberValues = { email: string; role: Role }

const ROLE_BADGE: Record<Role, BadgeTone> = {
  ADMIN: 'primary',
  MEMBER: 'default',
  VIEWER: 'warning',
}

async function fetchWorkspaces() {
  await request('/api/auth/csrf')
  return request<Workspace[]>('/api/workspaces')
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

@Component({
  selector: 'app-members-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    BadgeComponent,
    ForbiddenComponent,
    MatButton,
    MatCard,
    MatCardContent,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatError,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    MatSort,
    MatSortHeader,
    MatTableModule,
    QueryErrorComponent,
    ReactiveFormsModule,
    RouterLink,
    StatusMessageComponent,
  ],
  template: `
    @if (loading()) {
      <main><p aria-live="polite">Loading members...</p></main>
    } @else if (forbidden()) {
      <app-forbidden message="You don't have access to this workspace's members." />
    } @else if (failed()) {
      <main>
        <app-query-error message="We couldn't load this workspace's members." (retry)="retry()" />
      </main>
    } @else {
      <main class="flex flex-col gap-8">
        <div class="flex flex-col gap-3">
          <p class="eyebrow">TeamFlow workspace</p>
          <h1 class="page-title">Members{{ workspace() ? ' – ' + workspace()!.name : '' }}</h1>
        </div>

        <section class="flex flex-col gap-3" aria-labelledby="members-heading">
          <h2 class="section-title" id="members-heading">Members</h2>
          @if (members().length === 0) {
            <app-alert severity="info" role="status">No members found.</app-alert>
          } @else {
            <mat-card appearance="outlined" class="app-card overflow-x-auto">
              <table
                mat-table
                aria-label="Workspace members"
                [dataSource]="sortedMembers()"
                [trackBy]="trackMember"
                matSort
                (matSortChange)="sort.set($event)"
              >
                <ng-container matColumnDef="displayName">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Member</th>
                  <td mat-cell *matCellDef="let member" class="min-w-[200px] !py-2">
                    <p class="font-bold">{{ member.displayName }}</p>
                    <p class="muted text-xs">{{ member.email }}</p>
                  </td>
                </ng-container>

                <ng-container matColumnDef="role">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="w-[180px]">Role</th>
                  <td mat-cell *matCellDef="let member">
                    @if (isAdmin()) {
                      <mat-form-field class="w-[9rem] !py-2">
                        <mat-select
                          [value]="member.role"
                          [aria-label]="'Role for ' + member.displayName"
                          (selectionChange)="changeRole(member, $event.value)"
                        >
                          <mat-option value="ADMIN">Admin</mat-option>
                          <mat-option value="MEMBER">Member</mat-option>
                          <mat-option value="VIEWER">Viewer</mat-option>
                        </mat-select>
                      </mat-form-field>
                    } @else {
                      <app-badge [tone]="roleBadge(member)">{{ member.role }}</app-badge>
                    }
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="w-[120px]"></th>
                  <td mat-cell *matCellDef="let member">
                    <button matButton="outlined" type="button" class="danger" (click)="confirmRemoval(member)">
                      Remove
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="columns()"></tr>
                <tr mat-row *matRowDef="let member; columns: columns()"></tr>
              </table>
            </mat-card>
          }

          @if (isAdmin()) {
            <mat-card appearance="outlined" class="app-card">
              <mat-card-content>
                <form
                  class="flex flex-col gap-3 sm:flex-row sm:items-start"
                  [formGroup]="memberForm"
                  (ngSubmit)="addMember()"
                  novalidate
                >
                  <mat-form-field class="w-full">
                    <mat-label>Email</mat-label>
                    <input matInput formControlName="email" type="email" />
                    <mat-error role="alert">{{ emailError() }}</mat-error>
                  </mat-form-field>
                  <mat-form-field class="min-w-[10rem]">
                    <mat-label>Role</mat-label>
                    <mat-select formControlName="role">
                      <mat-option value="MEMBER">Member</mat-option>
                      <mat-option value="VIEWER">Viewer</mat-option>
                      <mat-option value="ADMIN">Admin</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <button
                    matButton="filled"
                    type="submit"
                    class="shrink-0 whitespace-nowrap sm:mt-1"
                    [disabled]="addMemberMutation.isPending()"
                  >
                    Add member
                  </button>
                </form>
              </mat-card-content>
            </mat-card>
          }
        </section>

        @if (actionForbidden()) {
          <app-alert severity="error">
            You don't have permission to do that. This action requires a higher role in this workspace.
          </app-alert>
        }
        <app-status-message [value]="message()" />
        <p><a routerLink="/dashboard">Back to dashboard</a></p>
      </main>
    }

    <ng-template #removeDialog let-member>
      <h2 mat-dialog-title>Remove member</h2>
      <mat-dialog-content>
        <p id="remove-member-description">
          Remove {{ member.displayName }} from this workspace? They will lose access immediately.
        </p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="button" class="danger" [mat-dialog-close]="true">Remove</button>
      </mat-dialog-actions>
    </ng-template>
  `,
})
export class MembersPageComponent {
  /** Bound from the `:workspaceId` route param. */
  readonly workspaceId = input.required<string>()

  private readonly queryClient = inject(QueryClient)
  private readonly dialog = inject(MatDialog)
  private readonly removeDialog = viewChild.required<TemplateRef<unknown>>('removeDialog')

  protected readonly message = signal<StatusMessageValue>(null)
  protected readonly actionForbidden = signal(false)
  protected readonly sort = signal<Sort>({ active: '', direction: '' })

  protected readonly workspacesQuery = injectQuery(() => ({
    queryKey: queryKeys.workspaces.all(),
    queryFn: fetchWorkspaces,
  }))
  protected readonly workspace = computed(() => this.workspacesQuery.data()?.find((item) => item.id === this.workspaceId()))
  protected readonly isAdmin = computed(() => this.workspace()?.myRole === 'ADMIN')

  protected readonly membersQuery = injectQuery(() => ({
    queryKey: queryKeys.workspaces.members(this.workspaceId()),
    queryFn: () => request<Member[]>(`/api/workspaces/${this.workspaceId()}/members`),
    enabled: !!this.workspaceId(),
  }))
  protected readonly members = computed(() => this.membersQuery.data() ?? [])
  protected readonly sortedMembers = computed(() =>
    sortRows(this.members(), this.sort(), (member, column) => (column === 'role' ? member.role : member.displayName)),
  )
  protected readonly columns = computed(() =>
    this.isAdmin() ? ['displayName', 'role', 'actions'] : ['displayName', 'role'],
  )

  protected readonly loading = computed(() => this.workspacesQuery.isLoading() || this.membersQuery.isLoading())
  protected readonly forbidden = computed(
    () => isForbidden(this.workspacesQuery.error()) || isForbidden(this.membersQuery.error()),
  )
  protected readonly failed = computed(
    () =>
      (this.workspacesQuery.isError() && !isForbidden(this.workspacesQuery.error())) ||
      (this.membersQuery.isError() && !isForbidden(this.membersQuery.error())),
  )

  protected readonly memberForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    role: new FormControl<MemberValues['role']>('MEMBER', { nonNullable: true }),
  })

  protected readonly addMemberMutation = injectMutation(() => ({
    mutationFn: (values: MemberValues) =>
      request(`/api/workspaces/${this.workspaceId()}/members`, { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      this.memberForm.reset()
      this.invalidateMembers()
      this.message.set({ text: 'Member added', tone: 'success' })
    },
    onError: (error: unknown) => this.fail(error, 'Unable to add member'),
  }))

  protected readonly changeRoleMutation = injectMutation(() => ({
    mutationFn: ({ member, role }: { member: Member; role: Role }) =>
      request(`/api/workspaces/${this.workspaceId()}/members/${member.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      this.invalidateMembers()
      this.message.set({ text: 'Member role updated', tone: 'success' })
    },
    onError: (error: unknown) => this.fail(error, 'Unable to update role'),
  }))

  protected readonly removeMemberMutation = injectMutation(() => ({
    mutationFn: (member: Member) =>
      request(`/api/workspaces/${this.workspaceId()}/members/${member.userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      this.invalidateMembers()
      this.message.set({ text: 'Member removed', tone: 'success' })
    },
    onError: (error: unknown) => this.fail(error, 'Unable to remove member'),
  }))

  constructor() {
    injectDocumentTitle(() => 'Members')
  }

  protected readonly trackMember = (_: number, member: Member) => member.userId

  protected roleBadge(member: Member) {
    return ROLE_BADGE[member.role]
  }

  protected emailError() {
    return errorMessage(this.memberForm.controls.email, EMAIL_MESSAGES)
  }

  protected retry() {
    void this.workspacesQuery.refetch()
    void this.membersQuery.refetch()
  }

  protected addMember() {
    const values = submitForm(this.memberForm)
    if (!values) return
    this.actionForbidden.set(false)
    this.addMemberMutation.mutate(values)
  }

  protected changeRole(member: Member, role: Role) {
    if (role === member.role) return
    this.actionForbidden.set(false)
    this.changeRoleMutation.mutate({ member, role })
  }

  protected confirmRemoval(member: Member) {
    this.dialog
      .open(this.removeDialog(), {
        data: member,
        role: 'alertdialog',
        ariaDescribedBy: 'remove-member-description',
        maxWidth: '26rem',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return
        this.actionForbidden.set(false)
        this.removeMemberMutation.mutate(member)
      })
  }

  private invalidateMembers() {
    void this.queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(this.workspaceId()) })
  }

  private fail(error: unknown, fallback: string) {
    if (isForbidden(error)) this.actionForbidden.set(true)
    this.message.set({ text: errorText(error, fallback), tone: 'error' })
  }
}
