import { ChangeDetectionStrategy, Component, input } from '@angular/core'

export type BadgeTone = 'default' | 'primary' | 'success' | 'warning' | 'error'

/** A small, read-only status label - not a Material chip, which is interactive. */
@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"badge badge-" + tone()' },
  template: '<ng-content />',
  styles: `
    :host {
      --tone: var(--mat-sys-on-surface-variant);
      display: inline-flex;
      align-items: center;
      height: 1.5rem;
      padding-inline: 0.5rem;
      border: 1px solid color-mix(in srgb, var(--tone) 60%, transparent);
      border-radius: 999px;
      color: var(--tone);
      font-size: 0.8125rem;
      line-height: 1;
      white-space: nowrap;
    }
    :host(.badge-primary) { --tone: var(--app-accent-text); }
    :host(.badge-success) { --tone: var(--app-success); }
    :host(.badge-warning) { --tone: var(--app-warning); }
    :host(.badge-error) { --tone: var(--mat-sys-error); }
  `,
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('default')
}
