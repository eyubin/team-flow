import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core'
import { MatCard, MatCardContent } from '@angular/material/card'
import { BadgeComponent, type BadgeTone } from './badge.component'

type HealthState = 'loading' | 'ok' | 'error'

type HealthBody = {
  status?: string
}

const BADGE_BY_STATE: Record<HealthState, { tone: BadgeTone; label: string }> = {
  loading: { tone: 'default', label: 'Checking' },
  ok: { tone: 'success', label: 'Healthy' },
  error: { tone: 'error', label: 'Unavailable' },
}

@Component({
  selector: 'app-health-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, MatCard, MatCardContent],
  template: `
    <mat-card appearance="outlined" class="app-card" aria-live="polite">
      <section>
        <mat-card-content>
          <div class="mb-2 flex items-center justify-between gap-3">
            <h2 class="subsection-title">API health</h2>
            <app-badge [tone]="badge().tone">{{ badge().label }}</app-badge>
          </div>
          <p class="muted">{{ state() === 'loading' ? 'Loading' : message() }}</p>
        </mat-card-content>
      </section>
    </mat-card>
  `,
})
export class HealthStatusComponent {
  protected readonly state = signal<HealthState>('loading')
  protected readonly message = signal('Checking API…')
  protected readonly badge = computed(() => BADGE_BY_STATE[this.state()])

  constructor() {
    const controller = new AbortController()
    inject(DestroyRef).onDestroy(() => controller.abort())

    fetch('/actuator/health', { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Health check failed (${response.status})`)
        }
        return (await response.json()) as HealthBody
      })
      .then((body) => {
        if (body.status === 'UP') {
          this.state.set('ok')
          this.message.set('API is UP')
          return
        }
        this.state.set('error')
        this.message.set(`API reported ${body.status ?? 'an unknown status'}`)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        this.state.set('error')
        this.message.set(error instanceof Error ? error.message : 'API is unreachable')
      })
  }
}
