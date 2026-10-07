import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { injectDocumentTitle } from '../lib/document-title'

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="flex max-w-[30rem] flex-col gap-4">
      <p class="eyebrow text-text-secondary">404</p>
      <h1 class="page-title-sm">Page not found</h1>
      <p class="muted">The page you're looking for doesn't exist or may have moved.</p>
      <p><a routerLink="/">Back to home</a></p>
    </main>
  `,
})
export class NotFoundPageComponent {
  constructor() {
    injectDocumentTitle(() => 'Page not found')
  }
}
