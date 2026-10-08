import type { Routes } from '@angular/router'
import { RequireAuthComponent } from './components/require-auth.component'
import { AuthPageComponent } from './pages/auth-page.component'

// The auth page is the landing route, so it stays in the main bundle. The rest
// are split out: the members page pulls in Material's table and sort, and the
// task board pulls in TanStack Virtual, none of which a signed-out visitor needs.
export const routes: Routes = [
  { path: '', pathMatch: 'full', component: AuthPageComponent },
  { path: 'auth', redirectTo: '' },
  {
    path: 'status',
    loadComponent: () => import('./pages/status-page.component').then((m) => m.StatusPageComponent),
  },
  {
    path: '',
    component: RequireAuthComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard-page.component').then((m) => m.DashboardPageComponent),
      },
      {
        path: 'account',
        loadComponent: () => import('./pages/account-page.component').then((m) => m.AccountPageComponent),
      },
      {
        path: 'admin/users',
        loadComponent: () => import('./pages/users-admin-page.component').then((m) => m.UsersAdminPageComponent),
      },
      {
        path: 'workspaces/:workspaceId/members',
        loadComponent: () => import('./pages/members-page.component').then((m) => m.MembersPageComponent),
      },
      {
        path: 'projects/:projectId/tasks',
        loadComponent: () => import('./pages/task-board-page.component').then((m) => m.TaskBoardPageComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found-page.component').then((m) => m.NotFoundPageComponent),
  },
]
