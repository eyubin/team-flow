import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { injectDocumentTitle } from '../lib/document-title'
import { AlertComponent } from './alert.component'

@Component({
  selector: 'app-forbidden',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, RouterLink],
  template: `
    <main class="flex max-w-[30rem] flex-col gap-4">
      <p class="eyebrow text-error">Access denied</p>
      <h1 class="page-title-sm">You don't have permission to view this</h1>
      <app-alert severity="error" icon="lock">
        {{ message() ?? "Your role in this workspace doesn't allow this. Ask an admin for access if you think this is a mistake." }}
      </app-alert>
      <p><a routerLink="/dashboard">Back to dashboard</a></p>
    </main>
  `,
})
export class ForbiddenComponent {
  readonly message = input<string>()

  constructor() {
    injectDocumentTitle(() => 'Access denied')
  }
}
