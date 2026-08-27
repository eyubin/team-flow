# Entity-relationship diagram

Logical model for MVP. Physical types (UUID vs BIGINT) are an implementation detail; **UUIDs** are the default for public IDs.

```mermaid
erDiagram
  users {
    uuid id PK
    string email UK
    string password_hash
    string display_name
    boolean enabled
    timestamptz created_at
    timestamptz updated_at
  }

  workspaces {
    uuid id PK
    string name
    uuid created_by FK
    timestamptz created_at
    timestamptz updated_at
  }

  workspace_members {
    uuid workspace_id PK, FK
    uuid user_id PK, FK
    string role
    timestamptz created_at
  }

  projects {
    uuid id PK
    uuid workspace_id FK
    string name
    text description
    timestamptz created_at
    timestamptz updated_at
  }

  tasks {
    uuid id PK
    uuid project_id FK
    string title
    text description
    string status
    string priority
    uuid assignee_id FK
    date due_date
    int version
    timestamptz created_at
    timestamptz updated_at
  }

  task_comments {
    uuid id PK
    uuid task_id FK
    uuid author_id FK
    text body
    timestamptz created_at
  }

  audit_events {
    uuid id PK
    uuid actor_id FK
    string action
    string entity_type
    uuid entity_id
    jsonb payload
    timestamptz created_at
  }

  users ||--o{ workspace_members : "membership"
  workspaces ||--o{ workspace_members : "has"
  users ||--o{ workspaces : "created_by"
  workspaces ||--o{ projects : "contains"
  projects ||--o{ tasks : "contains"
  users ||--o{ tasks : "assignee"
  tasks ||--o{ task_comments : "has"
  users ||--o{ task_comments : "author"
  users ||--o{ audit_events : "actor"
```

## Constraints and indexes

- `users.email` unique, stored lowercase.
- `workspace_members` primary key `(workspace_id, user_id)`; `role` in `ADMIN`, `MEMBER`, `VIEWER`.
- `tasks.status` in `TODO`, `IN_PROGRESS`, `DONE`.
- `tasks.priority` in `LOW`, `MEDIUM`, `HIGH`.
- `tasks.version` starts at `0` and is incremented by JPA optimistic locking.
- `tasks.assignee_id` nullable; if set, assignee must be a member of the task’s workspace (enforced in application layer).

Indexes aligned with list/filter queries (see [ADR 0003](../adr/0003-optimistic-locking.md) for concurrency; indexes justified here):

| Index                                         | Query                                      |
| --------------------------------------------- | ------------------------------------------ |
| `tasks (project_id, created_at DESC)`         | Default board/list                         |
| `tasks (project_id, status)`                  | Filter by status                           |
| `tasks (project_id, assignee_id)`             | Filter by assignee                         |
| `tasks (project_id, priority)`                | Filter by priority                         |
| `audit_events (entity_type, entity_id, created_at DESC)` | History for a task/project     |
| `workspace_members (user_id)`                 | “My workspaces” lookup                     |
