import { ChangeDetectionStrategy, Component, type TemplateRef, inject, input, signal, viewChild } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatDialog, MatDialogActions, MatDialogContent, MatDialogTitle } from '@angular/material/dialog'
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { Router, RouterLink } from '@angular/router'
import { QueryClient, injectMutation } from '@tanstack/angular-query-experimental'
import { AlertComponent } from '../components/alert.component'
import { StatusMessageComponent, type StatusMessageValue } from '../components/status-message.component'
import { csrfToken, request } from '../lib/api'
import { broadcastSignedOut, clearSession, injectProfile, type Profile } from '../lib/auth'
import { injectDocumentTitle } from '../lib/document-title'
import { type ErrorMessages, errorMessage, matchesControl, notBlank, requiredWhen, submitForm } from '../lib/form-validation'
import { queryKeys } from '../lib/query-keys'

type ProfileValues = { displayName: string; email: string; currentPassword: string }
type PasswordValues = { currentPassword: string; newPassword: string; confirmPassword: string }

const PROFILE_MESSAGES: Record<keyof ProfileValues, ErrorMessages> = {
  displayName: { required: 'Display name is required', blank: 'Display name is required' },
  email: { required: 'Email is required', email: 'Enter a valid email address' },
  currentPassword: { required: 'Enter your current password to change your email' },
}

const PASSWORD_MESSAGES: Record<keyof PasswordValues, ErrorMessages> = {
  currentPassword: { required: 'Current password is required' },
  newPassword: { required: 'Password must be at least 8 characters', minlength: 'Password must be at least 8 characters' },
  confirmPassword: { mismatch: 'Passwords do not match' },
}

function emailChanged(email: string, currentEmail: string) {
  return email.trim().toLowerCase() !== currentEmail
}

async function mutate<T = unknown>(url: string, method: 'PATCH' | 'PUT' | 'DELETE', body: unknown) {
  if (!csrfToken()) await request('/api/auth/csrf')
  return request<T>(url, { method, body: JSON.stringify(body) })
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

const FIELD_IMPORTS = [MatError, MatFormField, MatInput, MatLabel, ReactiveFormsModule]

@Component({
  selector: 'app-profile-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FIELD_IMPORTS, MatButton, MatCard, MatCardContent, MatHint, StatusMessageComponent],
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="profile-heading">
      <h2 class="section-title" id="profile-heading">Profile</h2>
      <mat-card appearance="outlined" class="app-card">
        <mat-card-content>
          <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field>
              <mat-label>Display name</mat-label>
              <input matInput formControlName="displayName" autocomplete="name" maxlength="80" />
              <mat-error role="alert">{{ error('displayName') }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" type="email" autocomplete="email" maxlength="320" />
              <mat-error role="alert">{{ error('email') }}</mat-error>
            </mat-form-field>
            @if (changingEmail()) {
              <mat-form-field>
                <mat-label>Current password</mat-label>
                <input
                  matInput
                  formControlName="currentPassword"
                  type="password"
                  autocomplete="current-password"
                  maxlength="128"
                />
                <!-- Only an error is announced; the hint is static. -->
                <mat-hint>Required to change the email you sign in with</mat-hint>
                <mat-error role="alert">{{ error('currentPassword') }}</mat-error>
              </mat-form-field>
            }
            <div>
              <button matButton="filled" type="submit" [disabled]="updateMutation.isPending()">Save profile</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
      <app-status-message [value]="message()" />
    </section>
  `,
})
export class ProfileSectionComponent {
  readonly profile = input.required<Profile>()

  private readonly queryClient = inject(QueryClient)
  protected readonly message = signal<StatusMessageValue>(null)

  protected readonly form = new FormGroup({
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required, notBlank] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    // Changing the email changes a login credential, so the API wants the
    // current password for it - and only then.
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: requiredWhen((control) => {
        const email: unknown = control.parent?.get('email')?.value
        return typeof email === 'string' && emailChanged(email, this.profile().email)
      }),
    }),
  })

  protected readonly updateMutation = injectMutation(() => ({
    mutationFn: (values: ProfileValues) =>
      mutate<Profile>('/api/users/me', 'PATCH', {
        displayName: values.displayName.trim(),
        email: values.email.trim(),
        ...(emailChanged(values.email, this.profile().email) ? { currentPassword: values.currentPassword } : {}),
      }),
    onSuccess: (updated: Profile) => {
      this.queryClient.setQueryData(queryKeys.auth.me(), updated)
      this.form.reset({ displayName: updated.displayName, email: updated.email, currentPassword: '' })
      this.message.set({ text: 'Profile updated', tone: 'success' })
    },
    onError: (error: unknown) => this.message.set({ text: errorText(error, 'Unable to update profile'), tone: 'error' }),
  }))

  ngOnInit() {
    const { displayName, email } = this.profile()
    this.form.reset({ displayName, email, currentPassword: '' })
  }

  // Read during change detection, which every keystroke in the form triggers.
  protected changingEmail() {
    return emailChanged(this.form.controls.email.value, this.profile().email)
  }

  protected error(name: keyof typeof this.form.controls) {
    return errorMessage(this.form.controls[name], PROFILE_MESSAGES[name])
  }

  protected submit() {
    const values = submitForm(this.form)
    if (!values) return
    this.message.set(null)
    this.updateMutation.mutate(values)
  }
}

@Component({
  selector: 'app-password-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FIELD_IMPORTS, MatButton, MatCard, MatCardContent, StatusMessageComponent],
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="password-heading">
      <h2 class="section-title" id="password-heading">Password</h2>
      <mat-card appearance="outlined" class="app-card">
        <mat-card-content>
          <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <!-- Lets password managers attach the new password to the right account. -->
            <input type="text" name="username" autocomplete="username" [value]="email()" readonly hidden />
            @for (field of fields; track field.name) {
              <mat-form-field>
                <mat-label>{{ field.label }}</mat-label>
                <input
                  matInput
                  type="password"
                  maxlength="128"
                  [formControlName]="field.name"
                  [autocomplete]="field.autocomplete"
                />
                <mat-error role="alert">{{ error(field.name) }}</mat-error>
              </mat-form-field>
            }
            <div>
              <button matButton="filled" type="submit" [disabled]="changePasswordMutation.isPending()">
                Change password
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
      <app-status-message [value]="message()" />
    </section>
  `,
})
export class PasswordSectionComponent {
  readonly email = input.required<string>()

  protected readonly message = signal<StatusMessageValue>(null)
  protected readonly fields = [
    { name: 'currentPassword', label: 'Current password', autocomplete: 'current-password' },
    { name: 'newPassword', label: 'New password', autocomplete: 'new-password' },
    { name: 'confirmPassword', label: 'Confirm new password', autocomplete: 'new-password' },
  ] as const

  protected readonly form = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: matchesControl('newPassword') }),
  })

  protected readonly changePasswordMutation = injectMutation(() => ({
    mutationFn: ({ currentPassword, newPassword }: PasswordValues) =>
      mutate('/api/users/me/password', 'PUT', { currentPassword, newPassword }),
    onSuccess: () => {
      this.form.reset()
      this.message.set({ text: 'Password changed', tone: 'success' })
    },
    onError: (error: unknown) => this.message.set({ text: errorText(error, 'Unable to change password'), tone: 'error' }),
  }))

  protected error(name: keyof typeof this.form.controls) {
    return errorMessage(this.form.controls[name], PASSWORD_MESSAGES[name])
  }

  protected submit() {
    const values = submitForm(this.form)
    if (!values) return
    this.message.set(null)
    this.changePasswordMutation.mutate(values)
  }
}

@Component({
  selector: 'app-delete-account-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    MatButton,
    MatCard,
    MatCardContent,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatInput,
    MatLabel,
  ],
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="delete-account-heading">
      <h2 class="section-title" id="delete-account-heading">Delete account</h2>
      <mat-card appearance="outlined" class="app-card danger-card">
        <mat-card-content class="flex flex-col items-start gap-4">
          <p class="muted">
            Your name and email are removed and you are signed out everywhere. Workspaces where you are the only
            member are deleted; elsewhere you are removed and your tasks are unassigned. This can't be undone.
          </p>
          <button matButton="outlined" type="button" class="danger" (click)="open()">Delete account</button>
        </mat-card-content>
      </mat-card>
    </section>

    <ng-template #confirmDialog>
      <form (submit)="$event.preventDefault(); confirm()" novalidate>
        <h2 mat-dialog-title>Delete your account?</h2>
        <mat-dialog-content class="flex flex-col gap-4">
          <p id="delete-account-description">This permanently deletes your account. Enter your password to confirm.</p>
          <mat-form-field>
            <mat-label>Password</mat-label>
            <input
              matInput
              type="password"
              autocomplete="current-password"
              maxlength="128"
              [value]="password()"
              (input)="password.set($any($event.target).value)"
            />
          </mat-form-field>
          @if (deleteMutation.isError()) {
            <app-alert severity="error">{{ deleteError() }}</app-alert>
          }
        </mat-dialog-content>
        <mat-dialog-actions align="end">
          <button matButton type="button" (click)="close()">Cancel</button>
          <button
            matButton="filled"
            type="submit"
            class="danger"
            [disabled]="!password() || deleteMutation.isPending()"
          >
            Delete account
          </button>
        </mat-dialog-actions>
      </form>
    </ng-template>
  `,
  styles: `
    .danger-card {
      --mat-card-outlined-outline-color: var(--mat-sys-error);
    }
  `,
})
export class DeleteAccountSectionComponent {
  private readonly queryClient = inject(QueryClient)
  private readonly router = inject(Router)
  private readonly dialog = inject(MatDialog)
  private readonly confirmDialog = viewChild.required<TemplateRef<unknown>>('confirmDialog')

  protected readonly password = signal('')

  protected readonly deleteMutation = injectMutation(() => ({
    mutationFn: () => mutate('/api/users/me', 'DELETE', { password: this.password() }),
    // The server has already expired this browser's cookies and rejects the
    // account's tokens everywhere; this ends the session in the UI, here and
    // in the user's other tabs.
    onSuccess: () => {
      this.dialog.closeAll()
      clearSession(this.queryClient)
      broadcastSignedOut()
      void this.router.navigate(['/'], { replaceUrl: true })
    },
  }))

  protected deleteError() {
    return errorText(this.deleteMutation.error(), 'Unable to delete account')
  }

  protected open() {
    this.dialog
      .open(this.confirmDialog(), {
        role: 'alertdialog',
        ariaDescribedBy: 'delete-account-description',
        maxWidth: '28rem',
      })
      .afterClosed()
      .subscribe(() => {
        this.password.set('')
        this.deleteMutation.reset()
      })
  }

  protected close() {
    this.dialog.closeAll()
  }

  protected confirm() {
    if (this.password()) this.deleteMutation.mutate()
  }
}

@Component({
  selector: 'app-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DeleteAccountSectionComponent, PasswordSectionComponent, ProfileSectionComponent, RouterLink],
  template: `
    <main class="flex flex-col gap-8">
      <div class="flex flex-col gap-3">
        <p class="eyebrow">TeamFlow account</p>
        <h1 class="page-title">Account settings</h1>
      </div>
      <!-- RequireAuth only renders this route once the profile has loaded. -->
      @if (profile.data(); as current) {
        <app-profile-section [profile]="current" />
        <app-password-section [email]="current.email" />
      }
      <app-delete-account-section />
      <p><a routerLink="/dashboard">Back to dashboard</a></p>
    </main>
  `,
})
export class AccountPageComponent {
  protected readonly profile = injectProfile()

  constructor() {
    injectDocumentTitle(() => 'Account settings')
  }
}
