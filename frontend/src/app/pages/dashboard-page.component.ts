import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { MatOption, MatSelect } from '@angular/material/select'
import { RouterLink } from '@angular/router'
import { QueryClient, injectMutation, injectQuery } from '@tanstack/angular-query-experimental'
import { AlertComponent } from '../components/alert.component'
import { ForbiddenComponent } from '../components/forbidden.component'
import { QueryErrorComponent } from '../components/query-error.component'
import { StatusMessageComponent, type StatusMessageValue } from '../components/status-message.component'
import { isForbidden, request } from '../lib/api'
import { injectDocumentTitle } from '../lib/document-title'
import { errorMessage, submitForm } from '../lib/form-validation'
import { queryKeys } from '../lib/query-keys'

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

type NameValues = { name: string }

const NAME_MESSAGES = { required: 'Name is required' }

function nameForm() {
  return new FormGroup({ name: new FormControl('', { nonNullable: true, validators: Validators.required }) })
}

async function fetchWorkspaces() {
  await request('/api/auth/csrf')
  return request<Workspace[]>('/api/workspaces')
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ForbiddenComponent,
    MatButton,
    MatCard,
    MatCardContent,
    MatError,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    QueryErrorComponent,
    ReactiveFormsModule,
    RouterLink,
    StatusMessageComponent,
  ],
  template: `
    @if (workspacesQuery.isLoading()) {
      <main><p aria-live="polite">Loading dashboard...</p></main>
    } @else if (forbidden()) {
      <app-forbidden message="You don't have access to this dashboard." />
    } @else if (workspacesFailed()) {
      <main>
        <app-query-error message="We couldn't load your workspaces." (retry)="workspacesQuery.refetch()" />
      </main>
    } @else {
      <main class="flex flex-col gap-8">
        <div class="flex flex-col gap-3">
          <p class="eyebrow">TeamFlow workspace</p>
          <h1 class="page-title">Project dashboard</h1>
          <p class="muted">Create a workspace, then give it a project to hold future tasks.</p>
        </div>

        <mat-card appearance="outlined" class="app-card">
          <mat-card-content>
            <form
              class="flex flex-col gap-3 sm:flex-row sm:items-start"
              [formGroup]="workspaceForm"
              (ngSubmit)="createWorkspace()"
              novalidate
            >
              <mat-form-field class="w-full">
                <mat-label>New workspace</mat-label>
                <input matInput formControlName="name" maxlength="120" />
                <mat-error role="alert">{{ nameError(workspaceForm) }}</mat-error>
              </mat-form-field>
              <button
                matButton="filled"
                type="submit"
                class="shrink-0 whitespace-nowrap sm:mt-1"
                [disabled]="createWorkspaceMutation.isPending()"
              >
                Create workspace
              </button>
            </form>
          </mat-card-content>
        </mat-card>

        @if (workspaces().length === 0) {
          <app-alert severity="info" role="status">No workspaces yet.</app-alert>
        } @else {
          <mat-form-field class="max-w-[20rem]">
            <mat-label>Workspace</mat-label>
            <mat-select [value]="activeWorkspace()" (selectionChange)="selectedWorkspace.set($event.value)">
              @for (workspace of workspaces(); track workspace.id) {
                <mat-option [value]="workspace.id">{{ workspace.name }} ({{ workspace.myRole }})</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-card appearance="outlined" class="app-card">
            <mat-card-content>
              <form
                class="flex flex-col gap-3 sm:flex-row sm:items-start"
                [formGroup]="projectForm"
                (ngSubmit)="createProject()"
                novalidate
              >
                <mat-form-field class="w-full">
                  <mat-label>New project</mat-label>
                  <input matInput formControlName="name" maxlength="120" />
                  <mat-error role="alert">{{ nameError(projectForm) }}</mat-error>
                </mat-form-field>
                <button
                  matButton="filled"
                  type="submit"
                  class="shrink-0 whitespace-nowrap sm:mt-1"
                  [disabled]="createProjectMutation.isPending()"
                >
                  Create project
                </button>
              </form>
            </mat-card-content>
          </mat-card>

          <section class="flex flex-col gap-3" aria-labelledby="projects-heading">
            <h2 class="section-title" id="projects-heading">Projects</h2>
            @if (projectsFailed()) {
              <app-query-error
                message="We couldn't load projects for this workspace."
                (retry)="projectsQuery.refetch()"
              />
            } @else if (projects().length === 0) {
              <app-alert severity="info" role="status">No projects in this workspace yet.</app-alert>
            } @else {
              <div class="flex flex-col gap-3">
                @for (project of projects(); track project.id) {
                  <mat-card appearance="outlined" class="app-card">
                    <mat-card-content class="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p class="font-bold">{{ project.name }}</p>
                        <p class="muted text-sm">{{ project.description ?? 'Ready for tasks' }}</p>
                      </div>
                      <a [routerLink]="['/projects', project.id, 'tasks']" [attr.aria-label]="'Open task board for ' + project.name">
                        Open task board
                      </a>
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            }
          </section>

          <p><a [routerLink]="['/workspaces', activeWorkspace(), 'members']">Manage members</a></p>
        }

        @if (actionForbidden()) {
          <app-alert severity="error">
            You don't have permission to do that. This action requires a higher role in this workspace.
          </app-alert>
        }
        <app-status-message [value]="message()" />
      </main>
    }
  `,
})
export class DashboardPageComponent {
  private readonly queryClient = inject(QueryClient)

  protected readonly selectedWorkspace = signal('')
  protected readonly message = signal<StatusMessageValue>(null)
  protected readonly actionForbidden = signal(false)

  protected readonly workspacesQuery = injectQuery(() => ({
    queryKey: queryKeys.workspaces.all(),
    queryFn: fetchWorkspaces,
  }))
  protected readonly workspaces = computed(() => this.workspacesQuery.data() ?? [])

  // Falls back to the first workspace until the user explicitly picks one, so a
  // freshly created (or freshly loaded) workspace is usable without an extra click.
  protected readonly activeWorkspace = computed(() => this.selectedWorkspace() || this.workspaces()[0]?.id || '')

  protected readonly projectsQuery = injectQuery(() => ({
    queryKey: queryKeys.workspaces.projects(this.activeWorkspace()),
    queryFn: () => request<Project[]>(`/api/workspaces/${this.activeWorkspace()}/projects`),
    enabled: !!this.activeWorkspace(),
  }))
  protected readonly projects = computed(() => this.projectsQuery.data() ?? [])

  protected readonly forbidden = computed(
    () => isForbidden(this.workspacesQuery.error()) || isForbidden(this.projectsQuery.error()),
  )
  protected readonly workspacesFailed = computed(
    () => this.workspacesQuery.isError() && !isForbidden(this.workspacesQuery.error()),
  )
  protected readonly projectsFailed = computed(
    () => this.projectsQuery.isError() && !isForbidden(this.projectsQuery.error()),
  )

  protected readonly workspaceForm = nameForm()
  protected readonly projectForm = nameForm()

  protected readonly createWorkspaceMutation = injectMutation(() => ({
    mutationFn: (values: NameValues) =>
      request<Workspace>('/api/workspaces', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: (workspace: Workspace) => {
      this.workspaceForm.reset()
      void this.queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all() })
      this.selectedWorkspace.set(workspace.id)
      this.message.set({ text: 'Workspace created', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) this.actionForbidden.set(true)
      this.message.set({ text: errorText(error, 'Unable to create workspace'), tone: 'error' })
    },
  }))

  protected readonly createProjectMutation = injectMutation(() => ({
    mutationFn: (values: NameValues) =>
      request(`/api/workspaces/${this.activeWorkspace()}/projects`, { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      this.projectForm.reset()
      void this.queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.projects(this.activeWorkspace()) })
      this.message.set({ text: 'Project created', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (isForbidden(error)) this.actionForbidden.set(true)
      this.message.set({ text: errorText(error, 'Unable to create project'), tone: 'error' })
    },
  }))

  constructor() {
    injectDocumentTitle(() => 'Dashboard')
  }

  protected nameError(form: ReturnType<typeof nameForm>) {
    return errorMessage(form.controls.name, NAME_MESSAGES)
  }

  protected createWorkspace() {
    const values = submitForm(this.workspaceForm)
    if (!values) return
    this.actionForbidden.set(false)
    this.createWorkspaceMutation.mutate(values)
  }

  protected createProject() {
    const values = submitForm(this.projectForm)
    if (!values) return
    this.actionForbidden.set(false)
    this.createProjectMutation.mutate(values)
  }
}
