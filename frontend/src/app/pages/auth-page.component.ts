import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatButton, MatIconButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatError, MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { Router, RouterLink } from '@angular/router'
import { QueryClient, injectMutation } from '@tanstack/angular-query-experimental'
import { IconComponent } from '../components/icon.component'
import { StatusMessageComponent, type StatusMessageValue } from '../components/status-message.component'
import { csrfToken } from '../lib/api'
import { broadcastSignedOut, clearSession, injectProfile, type Profile } from '../lib/auth'
import { injectDocumentTitle } from '../lib/document-title'
import { type ErrorMessages, errorMessage, requiredWhen, submitForm } from '../lib/form-validation'
import { queryKeys } from '../lib/query-keys'

type Mode = 'login' | 'register'

type LoginValues = { email: string; password: string }
type RegisterValues = LoginValues & { displayName: string }

const MESSAGES: Record<'email' | 'password' | 'displayName', ErrorMessages> = {
  email: { required: 'Email is required', email: 'Enter a valid email address' },
  password: { required: 'Password must be at least 8 characters', minlength: 'Password must be at least 8 characters' },
  displayName: { required: 'Display name is required' },
}

async function authenticate(mode: Mode, values: LoginValues | RegisterValues): Promise<Profile> {
  await fetch('/api/auth/csrf', { credentials: 'include' })
  const response = await fetch(`/api/auth/${mode}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken() ?? '',
    },
    body: JSON.stringify(values),
  })
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(problem?.detail ?? `Request failed (${response.status})`)
  }
  return (await response.json()) as Profile
}

async function signOut() {
  await fetch('/api/auth/csrf', { credentials: 'include' })
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-XSRF-TOKEN': csrfToken() ?? '' },
  })
}

@Component({
  selector: 'app-auth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    MatButton,
    MatCard,
    MatCardContent,
    MatError,
    MatFormField,
    MatIconButton,
    MatInput,
    MatLabel,
    MatSuffix,
    ReactiveFormsModule,
    RouterLink,
    StatusMessageComponent,
  ],
  host: { class: 'flex min-h-[calc(100vh-12rem)] items-center justify-center' },
  template: `
    @if (profile.data(); as current) {
      <main class="flex w-full max-w-[30rem] flex-col gap-3">
        <p class="eyebrow">TeamFlow account</p>
        <h1 class="page-title-sm">Welcome, {{ current.displayName }}</h1>
        <p class="muted">{{ current.email }}</p>
        <div class="flex items-center gap-3">
          <button matButton="outlined" type="button" [disabled]="logoutMutation.isPending()" (click)="logoutMutation.mutate()">
            Sign out
          </button>
          <a routerLink="/dashboard">Open dashboard</a>
          <a routerLink="/account">Account settings</a>
        </div>
        <app-status-message [value]="message()" />
      </main>
    } @else {
      <main class="w-full max-w-[26rem]">
        <div class="mb-6 flex flex-col gap-3">
          <p class="eyebrow">TeamFlow account</p>
          <h1 class="page-title-sm">{{ mode() === 'login' ? 'Sign in' : 'Create your account' }}</h1>
          <p class="muted">Use the local account flow to enter your workspace.</p>
        </div>
        <mat-card appearance="outlined" class="app-card">
          <mat-card-content>
            <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()" novalidate>
              @if (mode() === 'register') {
                <mat-form-field>
                  <mat-label>Display name</mat-label>
                  <input matInput formControlName="displayName" autocomplete="name" maxlength="80" />
                  <mat-error role="alert">{{ error('displayName') }}</mat-error>
                </mat-form-field>
              }
              <mat-form-field>
                <mat-label>Email</mat-label>
                <input matInput formControlName="email" type="email" autocomplete="email" maxlength="320" />
                <mat-error role="alert">{{ error('email') }}</mat-error>
              </mat-form-field>
              <mat-form-field>
                <mat-label>Password</mat-label>
                <input
                  matInput
                  formControlName="password"
                  maxlength="128"
                  [type]="showPassword() ? 'text' : 'password'"
                  [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
                />
                <button
                  matIconButton
                  matSuffix
                  type="button"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                  (click)="showPassword.set(!showPassword())"
                >
                  <app-icon [name]="showPassword() ? 'visibility-off' : 'visibility'" />
                </button>
                <mat-error role="alert">{{ error('password') }}</mat-error>
              </mat-form-field>
              <button matButton="filled" type="submit" [disabled]="authMutation.isPending()">
                {{ authMutation.isPending() ? 'Working...' : mode() === 'login' ? 'Sign in' : 'Register' }}
              </button>
            </form>
          </mat-card-content>
        </mat-card>
        <div class="mt-4 flex flex-col items-start gap-2">
          <button matButton type="button" (click)="toggleMode()">
            {{ mode() === 'login' ? 'Need an account?' : 'Already registered?' }}
          </button>
          <app-status-message [value]="message()" />
        </div>
      </main>
    }
  `,
})
export class AuthPageComponent {
  private readonly queryClient = inject(QueryClient)
  private readonly router = inject(Router)

  protected readonly profile = injectProfile()
  protected readonly mode = signal<Mode>('login')
  protected readonly message = signal<StatusMessageValue>(null)
  protected readonly showPassword = signal(false)

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    // Only the register form shows this field, so only it requires one.
    displayName: new FormControl('', {
      nonNullable: true,
      validators: requiredWhen(() => this.mode() === 'register'),
    }),
  })

  protected readonly authMutation = injectMutation(() => ({
    mutationFn: (values: LoginValues | RegisterValues) => authenticate(this.mode(), values),
    onSuccess: (profile: Profile) => {
      this.queryClient.setQueryData(queryKeys.auth.me(), profile)
      this.message.set({ text: 'Signed in', tone: 'success' })
      void this.router.navigate(['/dashboard'])
    },
    onError: (error: unknown) => {
      this.message.set({ text: error instanceof Error ? error.message : 'Request failed', tone: 'error' })
    },
  }))

  protected readonly logoutMutation = injectMutation(() => ({
    mutationFn: signOut,
    onSuccess: () => {
      clearSession(this.queryClient)
      broadcastSignedOut()
      this.message.set({ text: 'Signed out', tone: 'success' })
    },
  }))

  constructor() {
    injectDocumentTitle(() => (this.profile.data() ? 'Account' : this.mode() === 'login' ? 'Sign in' : 'Create account'))
  }

  protected error(name: keyof typeof this.form.controls) {
    return errorMessage(this.form.controls[name], MESSAGES[name])
  }

  protected submit() {
    const register = this.mode() === 'register'
    const values = submitForm(this.form)
    if (!values) return
    this.message.set(null)
    this.authMutation.mutate(register ? values : { email: values.email, password: values.password })
  }

  protected toggleMode() {
    this.mode.update((current) => (current === 'login' ? 'register' : 'login'))
    this.showPassword.set(false)
    this.form.reset()
  }
}
