import { ChangeDetectionStrategy, Component, type Type } from '@angular/core'
import { MATERIAL_ANIMATIONS } from '@angular/material/core'
import { TestBed } from '@angular/core/testing'
import { Router, RouterOutlet, provideRouter, withComponentInputBinding, type Routes } from '@angular/router'
import { provideTanStackQuery } from '@tanstack/angular-query-experimental'
import { render } from '@testing-library/angular'
import userEvent from '@testing-library/user-event'
import { provideMaterialDefaults } from '../app/material-defaults'
import { createTestQueryClient } from './query-client'

type RenderOptions = {
  /** Initial URL, e.g. '/projects/project-1/tasks'. */
  route?: string
  /** Route pattern to mount the component under, when it reads URL params. */
  path?: string
  /**
   * A whole route tree, for tests about guards, redirects and the app shell.
   * The component is rendered as the root and must hold the router outlet -
   * pass `RouterOutletHostComponent` when the test has no root of its own.
   */
  routes?: Routes
}

@Component({
  selector: 'app-test-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class RouterOutletHostComponent {}

@Component({ selector: 'app-test-empty', template: '' })
class EmptyRouteComponent {}

/** The providers every rendered component gets; the app's equivalents live in app.config.ts. */
export function testProviders(routes: Routes = []) {
  return [
    // As in app.config.ts, route params arrive as component inputs.
    provideRouter(routes, withComponentInputBinding()),
    provideTanStackQuery(createTestQueryClient()),
    provideMaterialDefaults(),
    // Dialogs, menus and selects open and close synchronously, so a test
    // never waits on a CSS transition jsdom will not run.
    { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
  ]
}

/**
 * Single place that knows which providers the app needs, so a test states what
 * it is testing and nothing else - and so swapping a provider is a one-line
 * change here rather than an edit to every test file.
 *
 * With `path`, the component is reached through a real router outlet, so
 * route params arrive as they do in the app. Without, it is rendered directly
 * at `route` (for links and active state).
 */
export async function renderWithProviders<T>(component: Type<T>, { route = '/', path, routes }: RenderOptions = {}) {
  const user = userEvent.setup()
  const [root, routeConfig]: [Type<unknown>, Routes] = routes
    ? [component, routes]
    : path
      ? [RouterOutletHostComponent, [{ path: path.replace(/^\//, ''), component }]]
      : [component, [{ path: '**', component: EmptyRouteComponent }]]

  const result = await render(root, { providers: testProviders(routeConfig) })
  await TestBed.inject(Router).navigateByUrl(route)

  return { user, ...result }
}
