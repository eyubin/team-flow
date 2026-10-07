import { ChangeDetectionStrategy, Component, input } from '@angular/core'

export type MessageTone = 'neutral' | 'success' | 'error'
export type StatusMessageValue = { text: string; tone: MessageTone } | null

/**
 * Single persistent aria-live region for form/mutation feedback.
 *
 * Kept rendered at all times (even with empty text) so assistive tech keeps
 * announcing updates reliably, while color/weight give sighted users a way
 * to tell an error apart from a success message at a glance instead of
 * having to read the copy.
 */
@Component({
  selector: 'app-status-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p aria-live="polite" class="text-sm" [class]="toneClass()">{{ value()?.text ?? '' }}</p>`,
})
export class StatusMessageComponent {
  readonly value = input<StatusMessageValue>(null)

  protected toneClass() {
    switch (this.value()?.tone) {
      case 'error':
        return 'text-error font-medium'
      case 'success':
        return 'text-success'
      default:
        return 'text-text-secondary'
    }
  }
}
