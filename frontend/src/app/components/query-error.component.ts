import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { AlertComponent } from './alert.component'

/**
 * Generic "this request failed" banner, distinct from the 403 Forbidden
 * page. Pages previously only branched on isLoading vs. isForbidden, so a
 * network blip or 500 fell through and rendered the empty state (e.g. "No
 * workspaces yet") as if the account genuinely had nothing in it.
 */
@Component({
  selector: 'app-query-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, MatButton],
  template: `
    <app-alert severity="error">
      {{ message() }}
      <button alertAction matButton type="button" class="danger" (click)="retry.emit()">Try again</button>
    </app-alert>
  `,
})
export class QueryErrorComponent {
  readonly message = input("We couldn't load this. Please try again.")
  readonly retry = output<void>()
}
