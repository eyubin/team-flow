import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { HealthStatusComponent } from '../components/health-status.component'
import { injectDocumentTitle } from '../lib/document-title'

@Component({
  selector: 'app-status-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HealthStatusComponent, RouterLink],
  template: `
    <main class="flex max-w-[34rem] flex-col gap-4">
      <h1 class="page-title">TeamFlow</h1>
      <p class="muted">Local skeleton is up when the API health check below reports <strong>UP</strong>.</p>
      <app-health-status />
      <p><a routerLink="/">Open account flow</a></p>
    </main>
  `,
})
export class StatusPageComponent {
  constructor() {
    injectDocumentTitle(() => 'Status')
  }
}
