import { ChangeDetectionStrategy, Component, type TemplateRef, computed, inject, signal, viewChild } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog'
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { MatOption, MatSelect } from '@angular/material/select'
import { MatSort, MatSortHeader, type Sort } from '@angular/material/sort'
import { MatTableModule } from '@angular/material/table'
import { RouterLink } from '@angular/router'
import { QueryClient, injectMutation, injectQuery } from '@tanstack/angular-query-experimental'
import { AlertComponent } from '../components/alert.component'
import { BadgeComponent } from '../components/badge.component'
import { ForbiddenComponent } from '../components/forbidden.component'
import { QueryErrorComponent } from '../components/query-error.component'
import { StatusMessageComponent, type StatusMessageValue } from '../components/status-message.component'
import { isForbidden, request } from '../lib/api'
import { type Profile, type SystemRole, injectProfile } from '../lib/auth'
import { injectDocumentTitle } from '../lib/document-title'
import { type ErrorMessages, errorMessage, notBlank, submitForm } from '../lib/form-validation'
import { queryKeys } from '../lib/query-keys'
import { sortRows } from '../lib/sort'

type AdminUser = {
  id: string
  email: string
  displayName: string
  systemRole: SystemRole
  createdAt: string
}

type CreateValues = { email: string; displayName: string; password: string; systemRole: SystemRole }
type EditValues = { email: string; displayName: string; systemRole: SystemRole; password: string }

const MESSAGES: Record<'email' | 'displayName' | 'password', ErrorMessages> = {
  email: { required: 'Email is required', email: 'Enter a valid email address' },
  displayName: { required: 'Display name is required', blank: 'Display name is required' },
  password: { required: 'Password is required', minlength: 'Use at least 8 characters' },
}

const ROLE_LABEL: Record<SystemRole, string> = { ADMIN: 'Admin', USER: 'User' }

async function fetchUsers() {
  await request('/api/auth/csrf')
  return request<AdminUser[]>('/api/admin/users')
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function createForm() {
  return new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required, notBlank] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    systemRole: new FormControl<SystemRole>('USER', { nonNullable: true }),
  })
}

function editForm() {
  return new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required, notBlank] }),
    systemRole: new FormControl<SystemRole>('USER', { nonNullable: true }),
    // Blank keeps the current password.
    password: new FormControl('', { nonNullable: true, validators: Validators.minLength(8) }),
  })
}

/**
 * Every user's account, for system admins. The API enforces the role; the
 * page only skips the request when the signed-in profile already says no.
 */
@Component({
  selector: 'app-users-admin-page',
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
    MatHint,
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
    @if (forbidden()) {
      <app-forbidden message="Only system administrators can manage users." />
    } @else if (usersQuery.isLoading()) {
      <main><p aria-live="polite">Loading users...</p></main>
    } @else if (usersQuery.isError()) {
      <main>
        <app-query-error message="We couldn't load the users." (retry)="usersQuery.refetch()" />
      </main>
    } @else {
      <main class="flex flex-col gap-8">
        <div class="flex flex-col gap-3">
          <p class="eyebrow">TeamFlow administration</p>
          <h1 class="page-title">Users</h1>
          <p class="muted">Create, edit and delete accounts. Admins can manage every user.</p>
        </div>

        <section class="flex flex-col gap-3" aria-labelledby="users-heading">
          <h2 class="section-title" id="users-heading">All users</h2>
          @if (users().length === 0) {
            <app-alert severity="info" role="status">No users found.</app-alert>
          } @else {
            <mat-card appearance="outlined" class="app-card overflow-x-auto">
              <table
                mat-table
                aria-label="Users"
                [dataSource]="sortedUsers()"
                [trackBy]="trackUser"
                matSort
                (matSortChange)="sort.set($event)"
              >
                <ng-container matColumnDef="displayName">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>User</th>
                  <td mat-cell *matCellDef="let user" class="min-w-[200px] !py-2">
                    <p class="font-bold">{{ user.displayName }}{{ user.id === me()?.id ? ' (you)' : '' }}</p>
                    <p class="muted text-xs">{{ user.email }}</p>
                  </td>
                </ng-container>

                <ng-container matColumnDef="systemRole">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="w-[110px]">Role</th>
                  <td mat-cell *matCellDef="let user">
                    <app-badge [tone]="user.systemRole === 'ADMIN' ? 'primary' : 'default'">
                      {{ roleLabel(user.systemRole) }}
                    </app-badge>
                  </td>
                </ng-container>

                <ng-container matColumnDef="createdAt">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header class="w-[130px]">Joined</th>
                  <td mat-cell *matCellDef="let user" class="muted text-sm">{{ joined(user) }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef class="w-[200px]"></th>
                  <td mat-cell *matCellDef="let user">
                    <div class="flex justify-end gap-2">
                      <button
                        matButton="outlined"
                        type="button"
                        [attr.aria-label]="'Edit ' + user.displayName"
                        (click)="openEdit(user)"
                      >
                        Edit
                      </button>
                      @if (user.id !== me()?.id) {
                        <button
                          matButton="outlined"
                          type="button"
                          class="danger"
                          [attr.aria-label]="'Delete ' + user.displayName"
                          (click)="confirmDelete(user)"
                        >
                          Delete
                        </button>
                      }
                    </div>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="columns"></tr>
                <tr mat-row *matRowDef="let user; columns: columns"></tr>
              </table>
            </mat-card>
          }
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="create-user-heading">
          <h2 class="section-title" id="create-user-heading">Add user</h2>
          <mat-card appearance="outlined" class="app-card">
            <mat-card-content>
              <form class="grid gap-3 sm:grid-cols-2" [formGroup]="createUserForm" (ngSubmit)="createUser()" novalidate>
                <mat-form-field>
                  <mat-label>Display name</mat-label>
                  <input matInput formControlName="displayName" maxlength="80" />
                  <mat-error role="alert">{{ error(createUserForm, 'displayName') }}</mat-error>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Email</mat-label>
                  <input matInput formControlName="email" type="email" maxlength="320" />
                  <mat-error role="alert">{{ error(createUserForm, 'email') }}</mat-error>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Password</mat-label>
                  <input matInput formControlName="password" type="password" autocomplete="new-password" maxlength="128" />
                  <mat-error role="alert">{{ error(createUserForm, 'password') }}</mat-error>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Role</mat-label>
                  <mat-select formControlName="systemRole">
                    <mat-option value="USER">User</mat-option>
                    <mat-option value="ADMIN">Admin</mat-option>
                  </mat-select>
                </mat-form-field>
                <div class="sm:col-span-2">
                  <button matButton="filled" type="submit" [disabled]="createMutation.isPending()">Add user</button>
                </div>
              </form>
            </mat-card-content>
          </mat-card>
        </section>

        <app-status-message [value]="message()" />
        <p><a routerLink="/dashboard">Back to dashboard</a></p>
      </main>
    }

    <ng-template #editDialog let-user>
      <form [formGroup]="editUserForm" (ngSubmit)="saveEdit(user)" novalidate>
        <h2 mat-dialog-title>Edit {{ user.displayName }}</h2>
        <mat-dialog-content class="flex flex-col gap-3">
          <mat-form-field>
            <mat-label>Display name</mat-label>
            <input matInput formControlName="displayName" maxlength="80" />
            <mat-error role="alert">{{ error(editUserForm, 'displayName') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" type="email" maxlength="320" />
            <mat-error role="alert">{{ error(editUserForm, 'email') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Role</mat-label>
            <mat-select formControlName="systemRole">
              <mat-option value="USER">User</mat-option>
              <mat-option value="ADMIN">Admin</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>New password</mat-label>
            <input matInput formControlName="password" type="password" autocomplete="new-password" maxlength="128" />
            <mat-hint>Leave blank to keep the current password</mat-hint>
            <mat-error role="alert">{{ error(editUserForm, 'password') }}</mat-error>
          </mat-form-field>
          @if (updateMutation.isError()) {
            <app-alert severity="error">{{ updateError() }}</app-alert>
          }
        </mat-dialog-content>
        <mat-dialog-actions align="end">
          <button matButton type="button" mat-dialog-close>Cancel</button>
          <button matButton="filled" type="submit" [disabled]="updateMutation.isPending()">Save</button>
        </mat-dialog-actions>
      </form>
    </ng-template>

    <ng-template #deleteDialog let-user>
      <h2 mat-dialog-title>Delete user</h2>
      <mat-dialog-content>
        <p id="delete-user-description">
          Delete {{ user.displayName }}? Their name and email are removed, they are signed out everywhere and removed
          from every workspace. This can't be undone.
        </p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="button" class="danger" [mat-dialog-close]="true">Delete</button>
      </mat-dialog-actions>
    </ng-template>
  `,
})
export class UsersAdminPageComponent {
  private readonly queryClient = inject(QueryClient)
  private readonly dialog = inject(MatDialog)
  private readonly editDialog = viewChild.required<TemplateRef<unknown>>('editDialog')
  private readonly deleteDialog = viewChild.required<TemplateRef<unknown>>('deleteDialog')

  private readonly profile = injectProfile()
  protected readonly me = computed(() => this.profile.data())
  private readonly isSystemAdmin = computed(() => this.me()?.systemRole === 'ADMIN')

  protected readonly message = signal<StatusMessageValue>(null)
  protected readonly sort = signal<Sort>({ active: '', direction: '' })
  protected readonly columns = ['displayName', 'systemRole', 'createdAt', 'actions']

  protected readonly usersQuery = injectQuery(() => ({
    queryKey: queryKeys.admin.users(),
    queryFn: fetchUsers,
    enabled: this.isSystemAdmin(),
  }))
  protected readonly users = computed(() => this.usersQuery.data() ?? [])
  protected readonly sortedUsers = computed(() =>
    sortRows(this.users(), this.sort(), (user, column) =>
      column === 'systemRole' ? user.systemRole : column === 'createdAt' ? user.createdAt : user.displayName,
    ),
  )
  protected readonly forbidden = computed(() => !this.isSystemAdmin() || isForbidden(this.usersQuery.error()))

  protected readonly createUserForm = createForm()
  protected readonly editUserForm = editForm()

  protected readonly createMutation = injectMutation(() => ({
    mutationFn: (values: CreateValues) =>
      request<AdminUser>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...values, email: values.email.trim(), displayName: values.displayName.trim() }),
      }),
    onSuccess: (user: AdminUser) => {
      this.createUserForm.reset()
      this.invalidateUsers()
      this.message.set({ text: `${user.displayName} added`, tone: 'success' })
    },
    onError: (error: unknown) => this.message.set({ text: errorText(error, 'Unable to add user'), tone: 'error' }),
  }))

  protected readonly updateMutation = injectMutation(() => ({
    mutationFn: ({ user, values }: { user: AdminUser; values: EditValues }) =>
      request<AdminUser>(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: values.displayName.trim(),
          email: values.email.trim(),
          systemRole: values.systemRole,
          ...(values.password ? { password: values.password } : {}),
        }),
      }),
    onSuccess: (updated: AdminUser) => {
      this.dialog.closeAll()
      this.invalidateUsers()
      // Editing yourself changes the profile the rest of the app reads -
      // including, after a self-demotion, whether this page is reachable.
      if (updated.id === this.me()?.id) {
        const { id, email, displayName, systemRole } = updated
        this.queryClient.setQueryData<Profile>(queryKeys.auth.me(), { id, email, displayName, systemRole })
      }
      this.message.set({ text: `${updated.displayName} updated`, tone: 'success' })
    },
  }))

  protected readonly deleteMutation = injectMutation(() => ({
    mutationFn: (user: AdminUser) => request(`/api/admin/users/${user.id}`, { method: 'DELETE' }),
    onSuccess: (_: unknown, user: AdminUser) => {
      this.invalidateUsers()
      this.message.set({ text: `${user.displayName} deleted`, tone: 'success' })
    },
    onError: (error: unknown) => this.message.set({ text: errorText(error, 'Unable to delete user'), tone: 'error' }),
  }))

  constructor() {
    injectDocumentTitle(() => 'Users')
  }

  protected readonly trackUser = (_: number, user: AdminUser) => user.id

  protected roleLabel(role: SystemRole) {
    return ROLE_LABEL[role]
  }

  protected joined(user: AdminUser) {
    return new Date(user.createdAt).toLocaleDateString()
  }

  protected error(form: FormGroup, name: keyof typeof MESSAGES) {
    return errorMessage(form.controls[name], MESSAGES[name])
  }

  protected updateError() {
    return errorText(this.updateMutation.error(), 'Unable to update user')
  }

  protected createUser() {
    const values = submitForm(this.createUserForm)
    if (!values) return
    this.message.set(null)
    this.createMutation.mutate(values)
  }

  protected openEdit(user: AdminUser) {
    this.editUserForm.reset({
      displayName: user.displayName,
      email: user.email,
      systemRole: user.systemRole,
      password: '',
    })
    this.updateMutation.reset()
    this.dialog.open(this.editDialog(), { data: user, maxWidth: '28rem', width: '100%' })
  }

  protected saveEdit(user: AdminUser) {
    const values = submitForm(this.editUserForm)
    if (!values) return
    this.updateMutation.mutate({ user, values })
  }

  protected confirmDelete(user: AdminUser) {
    this.dialog
      .open(this.deleteDialog(), {
        data: user,
        role: 'alertdialog',
        ariaDescribedBy: 'delete-user-description',
        maxWidth: '26rem',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return
        this.message.set(null)
        this.deleteMutation.mutate(user)
      })
  }

  private invalidateUsers() {
    void this.queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() })
  }
}
