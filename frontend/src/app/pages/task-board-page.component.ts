import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type TemplateRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog'
import { MatDivider } from '@angular/material/divider'
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { MatOption, MatSelect } from '@angular/material/select'
import { MatSort, MatSortHeader, type Sort } from '@angular/material/sort'
import { RouterLink } from '@angular/router'
import { injectVirtualizer } from '@tanstack/angular-virtual'
import { QueryClient, injectMutation, injectQuery } from '@tanstack/angular-query-experimental'
import { AlertComponent } from '../components/alert.component'
import { BadgeComponent } from '../components/badge.component'
import { ForbiddenComponent } from '../components/forbidden.component'
import { QueryErrorComponent } from '../components/query-error.component'
import { StatusMessageComponent, type StatusMessageValue } from '../components/status-message.component'
import { SplitViewComponent } from '../layout/split-view.component'
import { ApiError, isForbidden, request } from '../lib/api'
import { injectDocumentTitle } from '../lib/document-title'
import { errorMessage, submitForm } from '../lib/form-validation'
import { queryKeys } from '../lib/query-keys'
import { sortRows } from '../lib/sort'
import { TaskEditFormComponent } from './task-edit-form.component'
import {
  type AuditEvent,
  COMMENT_MESSAGES,
  type Comment,
  type CommentValues,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  type Task,
  type TaskFormValues,
  type TaskPage,
  TITLE_MESSAGES,
  createCommentForm,
  createTaskForm,
} from './task-model'

// Long boards get virtualised rows; short ones render plainly, so the common
// case carries no scroll container and no windowing maths.
const VIRTUALIZE_ABOVE = 30
const ROW_HEIGHT = 53

async function fetchTasks(projectId: string, filterStatus: string, filterPriority: string, assigneeFilter: string) {
  await request('/api/auth/csrf')
  const query = new URLSearchParams({ size: '100', sort: 'createdAt,desc' })
  if (filterStatus) query.set('status', filterStatus)
  if (filterPriority) query.set('priority', filterPriority)
  if (assigneeFilter.trim()) query.set('assigneeId', assigneeFilter.trim())
  return request<TaskPage>(`/api/projects/${projectId}/tasks?${query}`)
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

@Component({
  selector: 'app-task-board-page',
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
    MatDivider,
    MatError,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    MatSort,
    MatSortHeader,
    QueryErrorComponent,
    ReactiveFormsModule,
    RouterLink,
    SplitViewComponent,
    StatusMessageComponent,
    TaskEditFormComponent,
  ],
  template: `
    @if (tasksQuery.isLoading()) {
      <main><p aria-live="polite">Loading tasks...</p></main>
    } @else if (forbidden()) {
      <app-forbidden message="You don't have access to this project's task board." />
    } @else if (failed()) {
      <main>
        <app-query-error message="We couldn't load this project's tasks." (retry)="tasksQuery.refetch()" />
      </main>
    } @else {
      <main>
        <app-split-view>
          <div splitStart class="flex flex-col gap-8">
            <div class="flex flex-col gap-3">
              <p class="eyebrow">TeamFlow project</p>
              <h1 class="page-title">Task board</h1>
            </div>

            <mat-card appearance="outlined" class="app-card">
              <mat-card-content>
                <form
                  class="flex flex-col gap-3 sm:flex-row sm:items-start"
                  [formGroup]="createForm"
                  (ngSubmit)="createTask()"
                  novalidate
                >
                  <mat-form-field class="min-w-[12rem] grow">
                    <mat-label>New task</mat-label>
                    <input matInput formControlName="title" maxlength="200" />
                    <mat-error role="alert">{{ createTitleError() }}</mat-error>
                  </mat-form-field>
                  <mat-form-field class="min-w-[9rem]">
                    <mat-label>Status</mat-label>
                    <mat-select formControlName="status">
                      <mat-option value="TODO">To do</mat-option>
                      <mat-option value="IN_PROGRESS">In progress</mat-option>
                      <mat-option value="DONE">Done</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field class="min-w-[9rem]">
                    <mat-label>Priority</mat-label>
                    <mat-select formControlName="priority">
                      <mat-option value="LOW">Low</mat-option>
                      <mat-option value="MEDIUM">Medium</mat-option>
                      <mat-option value="HIGH">High</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field class="min-w-[10rem]">
                    <mat-label>Assignee ID</mat-label>
                    <input matInput formControlName="assigneeId" placeholder="Optional UUID" />
                  </mat-form-field>
                  <button
                    matButton="filled"
                    type="submit"
                    class="shrink-0 whitespace-nowrap sm:mt-1"
                    [disabled]="createTaskMutation.isPending()"
                  >
                    Create task
                  </button>
                </form>
              </mat-card-content>
            </mat-card>

            <mat-card appearance="outlined" class="app-card">
              <mat-card-content>
                <form
                  class="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-start"
                  (submit)="$event.preventDefault(); tasksQuery.refetch()"
                >
                  <mat-form-field class="min-w-[10rem]">
                    <mat-label>Filter status</mat-label>
                    <mat-select [value]="filterStatus() || 'ALL'" (selectionChange)="setFilterStatus($event.value)">
                      <mat-option value="ALL">All statuses</mat-option>
                      <mat-option value="TODO">To do</mat-option>
                      <mat-option value="IN_PROGRESS">In progress</mat-option>
                      <mat-option value="DONE">Done</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field class="min-w-[10rem]">
                    <mat-label>Filter priority</mat-label>
                    <mat-select [value]="filterPriority() || 'ALL'" (selectionChange)="setFilterPriority($event.value)">
                      <mat-option value="ALL">All priorities</mat-option>
                      <mat-option value="LOW">Low</mat-option>
                      <mat-option value="MEDIUM">Medium</mat-option>
                      <mat-option value="HIGH">High</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field>
                    <mat-label>Filter by assignee ID</mat-label>
                    <input
                      matInput
                      placeholder="Optional UUID"
                      [value]="assigneeFilter()"
                      (input)="assigneeFilter.set($any($event.target).value)"
                    />
                  </mat-form-field>
                  <button matButton="outlined" type="submit" class="shrink-0 whitespace-nowrap sm:mt-1">Apply filters</button>
                  <button matButton type="button" class="sm:mt-1" (click)="clearFilters()">Clear</button>
                </form>
              </mat-card-content>
            </mat-card>

            @if (tasks().length === 0) {
              <app-alert severity="info" role="status">No tasks in this project yet.</app-alert>
            } @else {
              <mat-card appearance="outlined" class="app-card overflow-hidden">
                <!-- The table's parent is the scroll container when the board is windowed. -->
                <div #scroller [class.task-scroller]="virtualize()">
                  <table class="task-table" aria-label="Tasks" matSort (matSortChange)="sort.set($event)">
                    <thead [class.sticky-head]="virtualize()">
                      <tr>
                        <th mat-sort-header="title">Title</th>
                        <th mat-sort-header="status">Status</th>
                        <th mat-sort-header="priority">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      @if (paddingTop() > 0) {
                        <tr class="spacer" [style.height.px]="paddingTop()"><td colspan="3"></td></tr>
                      }
                      @for (task of visibleRows(); track task.id) {
                        <tr [class.selected]="task.id === selectedTaskId()">
                          <td>
                            <button type="button" class="link-button font-bold" (click)="selectTask(task)">
                              {{ task.title }}
                            </button>
                          </td>
                          <td>
                            <app-badge [tone]="statusTone[task.status]">{{ statusLabel[task.status] }}</app-badge>
                          </td>
                          <td>
                            <app-badge [tone]="priorityTone[task.priority]">{{ task.priority }}</app-badge>
                          </td>
                        </tr>
                      }
                      @if (paddingBottom() > 0) {
                        <tr class="spacer" [style.height.px]="paddingBottom()"><td colspan="3"></td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </mat-card>
            }
          </div>

          @if (selectedTask(); as task) {
            <section splitEnd class="flex flex-col gap-4" aria-labelledby="task-detail-heading">
              <mat-divider />
              <h2 class="section-title" id="task-detail-heading">Task details</h2>
              <app-task-edit-form
                [task]="task"
                [saving]="updateTaskMutation.isPending()"
                (save)="saveTask($event)"
                (delete)="confirmDelete()"
              />

              @if (hasConflict()) {
                <app-alert severity="warning">
                  This task has changed on the server.
                  <button type="button" class="link-button" (click)="reloadSelectedTask()">Reload task</button>
                </app-alert>
              }

              <div class="flex flex-col gap-3">
                <h3 class="subsection-title">Comments</h3>
                <form
                  class="flex flex-col gap-3 sm:flex-row sm:items-start"
                  [formGroup]="commentForm"
                  (ngSubmit)="addComment()"
                  novalidate
                >
                  <mat-form-field class="min-w-[12rem] grow">
                    <mat-label>Comment</mat-label>
                    <input matInput formControlName="body" maxlength="4000" />
                    <mat-error role="alert">{{ commentError() }}</mat-error>
                  </mat-form-field>
                  <button
                    matButton="filled"
                    type="submit"
                    class="shrink-0 whitespace-nowrap sm:mt-1"
                    [disabled]="addCommentMutation.isPending()"
                  >
                    Add comment
                  </button>
                </form>
                @if (commentsQuery.isLoading()) {
                  <p class="muted text-sm" aria-live="polite">Loading comments...</p>
                } @else if (comments().length === 0) {
                  <app-alert severity="info" role="status">No comments yet.</app-alert>
                } @else {
                  <div class="flex flex-col gap-2">
                    @for (comment of comments(); track comment.id) {
                      <mat-card appearance="outlined" class="app-card">
                        <mat-card-content class="!py-3">
                          <p class="text-sm">{{ comment.body }}</p>
                        </mat-card-content>
                      </mat-card>
                    }
                  </div>
                }
              </div>

              <div class="flex flex-col gap-3">
                <h3 class="subsection-title">History</h3>
                @if (auditQuery.isLoading()) {
                  <p class="muted text-sm" aria-live="polite">Loading history...</p>
                } @else if (auditEvents().length === 0) {
                  <app-alert severity="info" role="status">No history yet.</app-alert>
                } @else {
                  <div class="flex flex-col gap-1">
                    @for (event of auditEvents(); track event.id) {
                      <p class="muted text-sm">{{ event.action }}</p>
                    }
                  </div>
                }
              </div>
            </section>
          } @else {
            <p splitPlaceholder>Select a task to see its details here.</p>
          }

          <div splitFooter class="flex flex-col gap-8">
            @if (actionForbidden()) {
              <app-alert severity="error">
                You don't have permission to do that. Your role in this project is read-only.
              </app-alert>
            }
            <app-status-message [value]="message()" />
            <p><a routerLink="/dashboard">Back to dashboard</a></p>
          </div>
        </app-split-view>
      </main>
    }

    <ng-template #deleteDialog>
      <h2 mat-dialog-title>Delete task</h2>
      <mat-dialog-content>
        <p id="delete-task-description">Delete {{ selectedTask()?.title }}? This can't be undone.</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="button" class="danger" [mat-dialog-close]="true">Delete</button>
      </mat-dialog-actions>
    </ng-template>
  `,
  styles: `
    .task-scroller {
      max-height: 32rem;
      overflow-y: auto;
    }
    .task-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    th,
    td {
      height: 53px;
      padding: 0 16px;
      text-align: left;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    th {
      font-weight: 500;
    }
    .sticky-head th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--mat-sys-surface-container-low);
    }
    tbody tr:not(.spacer):hover {
      background: color-mix(in srgb, var(--mat-sys-on-surface) 4%, transparent);
    }
    tr.selected {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }
    .spacer td {
      padding: 0;
      border: 0;
    }
  `,
})
export class TaskBoardPageComponent {
  /** Bound from the `:projectId` route param. */
  readonly projectId = input.required<string>()

  private readonly queryClient = inject(QueryClient)
  private readonly dialog = inject(MatDialog)
  private readonly deleteDialog = viewChild.required<TemplateRef<unknown>>('deleteDialog')
  private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller')

  protected readonly statusLabel = STATUS_LABEL
  protected readonly statusTone = STATUS_TONE
  protected readonly priorityTone = PRIORITY_TONE

  protected readonly filterStatus = signal<Task['status'] | ''>('')
  protected readonly filterPriority = signal<Task['priority'] | ''>('')
  protected readonly assigneeFilter = signal('')
  protected readonly message = signal<StatusMessageValue>(null)
  protected readonly actionForbidden = signal(false)
  protected readonly selectedTaskId = signal<string | null>(null)
  protected readonly hasConflict = signal(false)
  protected readonly sort = signal<Sort>({ active: '', direction: '' })

  protected readonly tasksQuery = injectQuery(() => ({
    queryKey: queryKeys.tasks.list(this.projectId(), {
      status: this.filterStatus(),
      priority: this.filterPriority(),
      assigneeId: this.assigneeFilter(),
    }),
    queryFn: () => fetchTasks(this.projectId(), this.filterStatus(), this.filterPriority(), this.assigneeFilter()),
    enabled: !!this.projectId(),
  }))
  protected readonly tasks = computed(() => this.tasksQuery.data()?.content ?? [])
  protected readonly selectedTask = computed(() => this.tasks().find((task) => task.id === this.selectedTaskId()) ?? null)

  protected readonly commentsQuery = injectQuery(() => ({
    queryKey: queryKeys.comments.byTask(this.selectedTaskId()!),
    queryFn: () => request<Comment[]>(`/api/tasks/${this.selectedTaskId()}/comments`),
    enabled: !!this.selectedTaskId(),
  }))
  protected readonly comments = computed(() => this.commentsQuery.data() ?? [])

  protected readonly auditQuery = injectQuery(() => ({
    queryKey: queryKeys.auditEvents.byTask(this.selectedTaskId()!),
    queryFn: () =>
      request<{ content: AuditEvent[] }>(`/api/audit-events?entityType=TASK&entityId=${this.selectedTaskId()}`),
    enabled: !!this.selectedTaskId(),
  }))
  protected readonly auditEvents = computed(() => this.auditQuery.data()?.content ?? [])

  protected readonly forbidden = computed(() => isForbidden(this.tasksQuery.error()))
  protected readonly failed = computed(() => this.tasksQuery.isError() && !isForbidden(this.tasksQuery.error()))

  protected readonly sortedTasks = computed(() =>
    sortRows(this.tasks(), this.sort(), (task, column) =>
      column === 'status' ? task.status : column === 'priority' ? task.priority : task.title,
    ),
  )
  protected readonly virtualize = computed(() => this.sortedTasks().length > VIRTUALIZE_ABOVE)

  private readonly virtualizer = injectVirtualizer(() => ({
    scrollElement: this.scroller(),
    count: this.sortedTasks().length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: this.virtualize(),
    // Gives the window a sane size before the scroll element is measured, so
    // the first paint (and any non-layout environment) renders rows rather
    // than nothing. Real measurements take over as soon as they arrive.
    initialRect: { width: 0, height: 512 },
  }))

  protected readonly visibleRows = computed(() => {
    const rows = this.sortedTasks()
    if (!this.virtualize()) return rows
    return this.virtualizer.getVirtualItems().map((item) => rows[item.index])
  })
  protected readonly paddingTop = computed(() => {
    const items = this.virtualizer.getVirtualItems()
    return this.virtualize() && items.length > 0 ? items[0].start : 0
  })
  protected readonly paddingBottom = computed(() => {
    const items = this.virtualizer.getVirtualItems()
    return this.virtualize() && items.length > 0 ? this.virtualizer.getTotalSize() - items[items.length - 1].end : 0
  })

  protected readonly createForm = createTaskForm()
  protected readonly commentForm = createCommentForm()

  protected readonly createTaskMutation = injectMutation(() => ({
    mutationFn: (values: TaskFormValues) =>
      request(`/api/projects/${this.projectId()}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ ...values, assigneeId: values.assigneeId.trim() || null }),
      }),
    onSuccess: () => {
      this.createForm.reset()
      void this.queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(this.projectId()) })
      this.message.set({ text: 'Task created', tone: 'success' })
    },
    onError: (error: unknown) => this.fail(error, 'Unable to create task'),
  }))

  protected readonly updateTaskMutation = injectMutation(() => ({
    mutationFn: ({ task, values }: { task: Task; values: TaskFormValues }) =>
      request<Task>(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...values, version: task.version, assigneeId: values.assigneeId.trim() || null }),
      }),
    onSuccess: (updated: Task) => {
      this.replaceTask(updated)
      this.hasConflict.set(false)
      this.message.set({ text: 'Task updated', tone: 'success' })
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.status === 409) {
        this.hasConflict.set(true)
        this.message.set({
          text: 'Conflict: this task changed elsewhere. Reload the task before saving again.',
          tone: 'error',
        })
        return
      }
      this.fail(error, 'Unable to update task')
    },
  }))

  protected readonly deleteTaskMutation = injectMutation(() => ({
    mutationFn: (task: Task) => request(`/api/tasks/${task.id}`, { method: 'DELETE' }).then(() => task),
    onSuccess: (deleted: Task) => {
      this.queryClient.setQueriesData<TaskPage>({ queryKey: queryKeys.tasks.byProject(this.projectId()) }, (old) =>
        old ? { ...old, content: old.content.filter((task) => task.id !== deleted.id) } : old,
      )
      this.selectedTaskId.set(null)
      this.message.set({ text: 'Task deleted', tone: 'success' })
    },
    onError: (error: unknown) => this.fail(error, 'Unable to delete task'),
  }))

  protected readonly addCommentMutation = injectMutation(() => ({
    mutationFn: ({ taskId, values }: { taskId: string; values: CommentValues }) =>
      request<Comment>(`/api/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify(values) }).then(
        (comment) => ({ taskId, comment }),
      ),
    onSuccess: ({ taskId, comment }: { taskId: string; comment: Comment }) => {
      this.queryClient.setQueryData<Comment[]>(queryKeys.comments.byTask(taskId), (old) => [comment, ...(old ?? [])])
      this.commentForm.reset()
      this.message.set({ text: 'Comment added', tone: 'success' })
    },
    onError: (error: unknown) => this.fail(error, 'Unable to add comment'),
  }))

  constructor() {
    injectDocumentTitle(() => 'Task board')
  }

  protected createTitleError() {
    return errorMessage(this.createForm.controls.title, TITLE_MESSAGES)
  }

  protected commentError() {
    return errorMessage(this.commentForm.controls.body, COMMENT_MESSAGES)
  }

  protected setFilterStatus(value: Task['status'] | 'ALL') {
    this.filterStatus.set(value === 'ALL' ? '' : value)
  }

  protected setFilterPriority(value: Task['priority'] | 'ALL') {
    this.filterPriority.set(value === 'ALL' ? '' : value)
  }

  protected clearFilters() {
    this.filterStatus.set('')
    this.filterPriority.set('')
    this.assigneeFilter.set('')
  }

  protected selectTask(task: Task) {
    this.selectedTaskId.set(task.id)
    this.hasConflict.set(false)
    this.actionForbidden.set(false)
  }

  protected createTask() {
    const values = submitForm(this.createForm)
    if (!values) return
    this.actionForbidden.set(false)
    this.createTaskMutation.mutate(values)
  }

  protected saveTask(values: TaskFormValues) {
    const task = this.selectedTask()
    if (!task) return
    this.actionForbidden.set(false)
    this.updateTaskMutation.mutate({ task, values })
  }

  protected addComment() {
    const taskId = this.selectedTaskId()
    const values = submitForm(this.commentForm)
    if (!taskId || !values) return
    this.actionForbidden.set(false)
    this.addCommentMutation.mutate({ taskId, values })
  }

  protected confirmDelete() {
    const task = this.selectedTask()
    if (!task) return
    this.dialog
      .open(this.deleteDialog(), {
        role: 'alertdialog',
        ariaDescribedBy: 'delete-task-description',
        maxWidth: '26rem',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return
        this.actionForbidden.set(false)
        this.deleteTaskMutation.mutate(task)
      })
  }

  protected async reloadSelectedTask() {
    const task = this.selectedTask()
    if (!task) return
    try {
      const fresh = await request<Task>(`/api/tasks/${task.id}`)
      this.replaceTask(fresh)
      this.hasConflict.set(false)
      void this.queryClient.invalidateQueries({ queryKey: queryKeys.comments.byTask(fresh.id) })
      void this.queryClient.invalidateQueries({ queryKey: queryKeys.auditEvents.byTask(fresh.id) })
      this.message.set({ text: 'Task reloaded', tone: 'success' })
    } catch (error) {
      this.message.set({ text: errorText(error, 'Unable to reload task'), tone: 'error' })
    }
  }

  private replaceTask(fresh: Task) {
    this.queryClient.setQueriesData<TaskPage>({ queryKey: queryKeys.tasks.byProject(this.projectId()) }, (old) =>
      old ? { ...old, content: old.content.map((task) => (task.id === fresh.id ? fresh : task)) } : old,
    )
  }

  private fail(error: unknown, fallback: string) {
    if (isForbidden(error)) this.actionForbidden.set(true)
    this.message.set({ text: errorText(error, fallback), tone: 'error' })
  }
}
