import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core'
import { provideRouter, withComponentInputBinding } from '@angular/router'
import { QueryClient, provideTanStackQuery } from '@tanstack/angular-query-experimental'
import { withDevtools } from '@tanstack/angular-query-experimental/devtools'
import { routes } from './app.routes'
import { provideMaterialDefaults } from './material-defaults'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideMaterialDefaults(),
    // Route params (`:projectId`, `:workspaceId`) arrive as component inputs.
    provideRouter(routes, withComponentInputBinding()),
    provideTanStackQuery(
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
      // Loaded only in development builds; production gets an empty stub.
      withDevtools(),
    ),
  ],
}
