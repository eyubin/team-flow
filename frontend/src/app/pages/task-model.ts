import { FormControl, FormGroup, Validators } from '@angular/forms'
import type { BadgeTone } from '../components/badge.component'

export type Task = {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  assigneeId?: string
  version: number
}

export type TaskPage = { content: Task[] }
export type Comment = { id: string; body: string; createdAt: string }
export type AuditEvent = { id: string; action: string; createdAt: string }

export type TaskFormValues = {
  title: string
  status: Task['status']
  priority: Task['priority']
  assigneeId: string
}
export type CommentValues = { body: string }

export const TITLE_MESSAGES = { required: 'Title is required' }
export const COMMENT_MESSAGES = { required: 'Comment is required' }

/** The create form and the edit form share this field set. */
export function createTaskForm() {
  return new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    status: new FormControl<Task['status']>('TODO', { nonNullable: true }),
    priority: new FormControl<Task['priority']>('MEDIUM', { nonNullable: true }),
    assigneeId: new FormControl('', { nonNullable: true }),
  })
}

export function createCommentForm() {
  return new FormGroup({ body: new FormControl('', { nonNullable: true, validators: Validators.required }) })
}

export const STATUS_LABEL: Record<Task['status'], string> = { TODO: 'To do', IN_PROGRESS: 'In progress', DONE: 'Done' }
export const STATUS_TONE: Record<Task['status'], BadgeTone> = { TODO: 'default', IN_PROGRESS: 'primary', DONE: 'success' }
export const PRIORITY_TONE: Record<Task['priority'], BadgeTone> = { LOW: 'default', MEDIUM: 'warning', HIGH: 'error' }
