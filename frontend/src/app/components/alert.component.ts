import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { IconComponent, type IconName } from './icon.component'

export type AlertSeverity = 'error' | 'warning' | 'info' | 'success'

const ICON: Record<AlertSeverity, IconName> = {
  error: 'error-outline',
  warning: 'warning-outline',
  info: 'info-outline',
  success: 'check',
}

/**
 * Inline banner. Angular Material has no alert, so this keeps the one the
 * app was designed around: a tinted panel with a severity icon, an optional
 * trailing action (`[alertAction]`), and `role="alert"` unless the caller
 * says otherwise - empty states pass `role="status"` so they don't interrupt.
 */
@Component({
  selector: 'app-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    '[attr.role]': 'role()',
    '[class]': '"alert alert-" + severity()',
  },
  template: `
    <app-icon class="alert-icon" [name]="iconName()" />
    <div class="alert-message"><ng-content /></div>
    <div class="alert-action"><ng-content select="[alertAction]" /></div>
  `,
  styles: `
    :host {
      --tone: var(--mat-sys-error);
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.375rem 1rem;
      border-radius: 8px;
      background: color-mix(in srgb, var(--tone) 12%, var(--mat-sys-surface));
      color: var(--mat-sys-on-surface);
      font-size: 0.875rem;
      line-height: 1.43;
    }
    :host(.alert-warning) { --tone: var(--app-warning); }
    :host(.alert-info) { --tone: var(--app-info); }
    :host(.alert-success) { --tone: var(--app-success); }
    .alert-icon { color: var(--tone); padding-block: 0.4375rem; }
    .alert-message { flex: 1; padding-block: 0.5rem; }
    .alert-action:empty { display: none; }
    .alert-action { align-self: center; margin-inline-end: -0.5rem; }
  `,
})
export class AlertComponent {
  readonly severity = input<AlertSeverity>('error')
  readonly role = input<'alert' | 'status'>('alert')
  readonly icon = input<IconName | undefined>(undefined)
  protected readonly iconName = computed(() => this.icon() ?? ICON[this.severity()])
}
