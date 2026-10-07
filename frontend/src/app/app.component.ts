import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core'
import { Router, RouterOutlet } from '@angular/router'
import { QueryClient } from '@tanstack/angular-query-experimental'
import { AppShellComponent } from './layout/app-shell.component'
import { onUnauthorized } from './lib/api'
import { clearSession, onSignedOutElsewhere } from './lib/auth'
import { ThemeService } from './theme/theme.service'

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppShellComponent, RouterOutlet],
  template: `
    <app-shell>
      <router-outlet />
    </app-shell>
  `,
})
export class AppComponent {
  constructor() {
    // Created eagerly so the stored or system appearance is applied on load.
    inject(ThemeService)

    const router = inject(Router)
    const queryClient = inject(QueryClient)

    // Both mean the session is gone: a request came back 401 (expired, or the
    // account was deleted on another device), or another tab signed out or
    // deleted the account.
    function signOut() {
      clearSession(queryClient)
      void router.navigate(['/'], { replaceUrl: true })
    }
    onUnauthorized(signOut)
    const stopListening = onSignedOutElsewhere(signOut)

    inject(DestroyRef).onDestroy(() => {
      onUnauthorized(null)
      stopListening()
    })
  }
}
