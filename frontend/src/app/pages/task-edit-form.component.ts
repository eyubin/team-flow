import { ChangeDetectionStrategy, Component, computed, effect, input, output, untracked } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCard, MatCardContent } from '@angular/material/card'
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { MatOption, MatSelect } from '@angular/material/select'
import { errorMessage, submitForm } from '../lib/form-validation'
import { TITLE_MESSAGES, type Task, type TaskFormValues, createTaskForm } from './task-model'

/**
 * The selected task's edit form. Values are loaded from the task once per
 * task *version*: a background refetch that returns the same version leaves
 * the user's unsaved edits alone, while a save, a reload after a conflict, or
 * picking another task refills the form.
 */
@Component({
  selector: 'app-task-edit-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatCard, MatCardContent, MatError, MatFormField, MatInput, MatLabel, MatOption, MatSelect, ReactiveFormsModule],
  template: `
    <mat-card appearance="outlined" class="app-card">
      <mat-card-content>
        <form class="flex flex-col gap-3" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-start">
            <mat-form-field class="min-w-[12rem] grow">
              <mat-label>Title</mat-label>
              <input matInput formControlName="title" maxlength="200" />
              <mat-error role="alert">{{ titleError() }}</mat-error>
            </mat-form-field>
            <mat-form-field class="min-w-[9rem]">
              <mat-label>Task status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="TODO">To do</mat-option>
                <mat-option value="IN_PROGRESS">In progress</mat-option>
                <mat-option value="DONE">Done</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field class="min-w-[9rem]">
              <mat-label>Task priority</mat-label>
              <mat-select formControlName="priority">
                <mat-option value="LOW">Low</mat-option>
                <mat-option value="MEDIUM">Medium</mat-option>
                <mat-option value="HIGH">High</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field>
              <mat-label>Task assignee ID</mat-label>
              <input matInput formControlName="assigneeId" placeholder="Optional UUID" />
            </mat-form-field>
          </div>
          <div class="flex gap-3">
            <button matButton="filled" type="submit" [disabled]="saving()">Save task</button>
            <button matButton="outlined" type="button" class="danger" (click)="delete.emit()">Delete task</button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
})
export class TaskEditFormComponent {
  readonly task = input.required<Task>()
  readonly saving = input(false)
  readonly save = output<TaskFormValues>()
  readonly delete = output<void>()

  protected readonly form = createTaskForm()

  // A string, so the effect below only re-runs when the identity or version
  // actually changes - not on every refetch that hands back an equal task.
  private readonly loadedVersion = computed(() => `${this.task().id}-${this.task().version}`)

  constructor() {
    effect(() => {
      this.loadedVersion()
      const task = untracked(this.task)
      this.form.reset({
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId ?? '',
      })
    })
  }

  protected titleError() {
    return errorMessage(this.form.controls.title, TITLE_MESSAGES)
  }

  protected submit() {
    const values = submitForm(this.form)
    if (values) this.save.emit(values)
  }
}
