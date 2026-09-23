export type TaskFilters = {
  status: string
  priority: string
  assigneeId: string
}

/**
 * Single source of truth for React Query cache keys.
 *
 * Keys were previously written inline at each call site, which made the
 * relationship between a query and the invalidation meant to refresh it
 * something you had to reconstruct by reading both. It also put two unrelated
 * families under the same `['tasks', …]` prefix - a project's task list and a
 * task's comments - which only stayed safe because a project id never happens
 * to equal a task id. `setQueriesData<TaskPage>` matches by prefix, so a
 * collision there would have written task-page data into a comment list.
 * Comments now have a root of their own.
 */
export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },

  workspaces: {
    /** Also the prefix for everything nested under a workspace. */
    all: () => ['workspaces'] as const,
    projects: (workspaceId: string) => ['workspaces', workspaceId, 'projects'] as const,
    members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
  },

  tasks: {
    /** Prefix covering every filter combination for one project. */
    byProject: (projectId: string) => ['tasks', 'list', projectId] as const,
    list: (projectId: string, filters: TaskFilters) => ['tasks', 'list', projectId, filters] as const,
  },

  comments: {
    byTask: (taskId: string) => ['comments', taskId] as const,
  },

  auditEvents: {
    byTask: (taskId: string) => ['audit-events', taskId] as const,
  },
}
