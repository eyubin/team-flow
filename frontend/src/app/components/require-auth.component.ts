import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core'
import { Router, RouterOutlet } from '@angular/router'
import { injectProfile } from '../lib/auth'
import { QueryErrorComponent } from './query-error.component'

/**
 * Parent route for everything that needs a session. It renders its children
 * only once the profile has loaded, so they can rely on it being there.
 */
@Component({
  selector: 'app-require-auth',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QueryErrorComponent, RouterOutlet],
  template: `
    @if (profile.isLoading()) {
      <main><p aria-live="polite">Checking your session...</p></main>
    } @else if (profile.isError() && profile.data() === undefined) {
      <!-- A network failure here is not the same as "not signed in" -
           redirecting to the login page would sign out a legitimately
           authenticated user just because a request dropped. Only when there
           is no profile at all: a failed background re-check (on window
           focus) keeps showing the page the user was already on. -->
      <main>
        <app-query-error
          message="We couldn't verify your session. Check your connection and try again."
          (retry)="profile.refetch()"
        />
      </main>
    } @else if (profile.data()) {
      <router-outlet />
    }
  `,
})
export class RequireAuthComponent {
  protected readonly profile = injectProfile()

  constructor() {
    const router = inject(Router)
    effect(() => {
      if (this.profile.isSuccess() && !this.profile.data()) {
        void router.navigate(['/'], { replaceUrl: true })
      }
    })
  }
}
