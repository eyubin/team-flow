# TeamFlow — user stories and acceptance criteria

Scope is the MVP. Roles are workspace-scoped: `ADMIN`, `MEMBER`, `VIEWER`.

Authentication uses short-lived JWTs stored in **HttpOnly cookies**, plus CSRF protection on mutating requests. See [ADR 0002](adr/0002-cookie-jwt-auth.md).

---

## Auth

### US-01 — Register

**As a** new user, **I want** to create an account with email and password **so that** I can use TeamFlow.

**Acceptance**

- Given a unused email and a password that meets policy, when I submit register, then an account is created and I am authenticated (cookies set).
- Given an email that already exists, when I submit register, then I receive `409` Problem Details and no cookies.
- Given invalid email or too-short password, when I submit register, then I receive `400` Problem Details with field errors; no account is created.
- Password is never returned in any response.

### US-02 — Login / logout / session

**As a** registered user, **I want** to log in and out **so that** my session is under my control.

**Acceptance**

- Given valid credentials, when I log in, then HttpOnly `access_token` and `refresh_token` cookies are set and `GET /api/auth/me` returns my profile.
- Given invalid credentials, when I log in, then I receive `401` without leaking whether the email exists; no cookies.
- Given an authenticated session, when I log out, then cookies are cleared and subsequent API calls return `401`.
- Given an expired access token and a valid refresh cookie, when I call refresh, then a new access cookie is issued.
- Mutating requests without a valid CSRF token are rejected (`403`).

### US-03 — Demo accounts

**As a** reviewer, **I want** seeded demo users **so that** I can try roles without registering.

**Acceptance**

- Demo emails and passwords are documented in README (not treated as secrets).
- Seed data creates one workspace, one project, sample tasks, and three members (`ADMIN`, `MEMBER`, `VIEWER`).

---

## Workspaces and projects

### US-04 — Create workspace and project

**As a** authenticated user, **I want** to create a workspace and a project **so that** I have a place for tasks.

**Acceptance**

- The creator becomes workspace `ADMIN`.
- Creating a project requires membership in that workspace.
- Empty name is rejected with `400`.
- `GET` of another user’s workspace without membership returns `403` (not `404` leaking existence where avoidable; if IDs are UUIDs, `404` is acceptable when the resource is not visible).

### US-05 — Invite / manage members (ADMIN)

**As an** `ADMIN`, **I want** to add members and change roles **so that** the team can collaborate.

**Acceptance**

- `ADMIN` can add a user by email, set role, change role, and remove a member (except the last `ADMIN`).
- `MEMBER` and `VIEWER` receive `403` on member-management endpoints.
- A user cannot access tasks of a workspace they are not a member of.

---

## Tasks

### US-06 — Create, edit, assign, and move tasks

**As a** `MEMBER` or `ADMIN`, **I want** to create and update tasks **so that** work is tracked.

**Acceptance**

- Task has title, description, status (`TODO` | `IN_PROGRESS` | `DONE`), priority (`LOW` | `MEDIUM` | `HIGH`), optional assignee (must be a workspace member), optional due date, and `version`.
- `VIEWER` can `GET` tasks and cannot `POST`/`PATCH`/`DELETE` (`403`).
- Assignee outside the workspace is rejected (`400` or `422`).
- Status transitions are explicit values only (no free-text status).

### US-07 — Filter, sort, and paginate

**As a** member, **I want** to filter tasks by assignee, status, and priority **so that** I can find work quickly.

**Acceptance**

- `GET /api/projects/{id}/tasks` supports `status`, `assigneeId`, `priority`, `sort`, `page`, `size`.
- Results are paginated; `size` is capped (max 100).
- Filters are applied in the database (not only in the UI).

### US-08 — Optimistic locking

**As a** user editing a task, **I want** concurrent edits to be detected **so that** I do not silently overwrite someone else.

**Acceptance**

- Updates include the last known `version`.
- If `version` does not match, the API returns `409` Problem Details including the current `version` (and enough data for the client to reload).
- The losing write is not applied.
- The UI shows a conflict state and offers reload.

---

## Comments and audit

### US-09 — Comments

**As a** `MEMBER` or `ADMIN`, **I want** to comment on a task **so that** discussion stays with the work.

**Acceptance**

- `VIEWER` can read comments and cannot create them (`403`).
- Empty body is rejected (`400`).
- Comments are listed newest-first or documented sort order.

### US-10 — Change history

**As a** member, **I want** to see who changed a task **so that** I can audit assignments and status.

**Acceptance**

- Create, update (including status/assignee), and comment actions produce `audit_events`.
- Events are readable by workspace members; non-members get `403`.
- Audit write happens in the same transaction as the mutation.

---

## Cross-cutting UI

### US-11 — Honest UI states

**As a** user, **I want** loading, empty, validation, forbidden, conflict, and server-error states **so that** the app is trustworthy.

**Acceptance**

- Login/register and task forms show field-level validation.
- Empty project board has a clear empty state.
- `403` routes/actions are explained (not a blank page).
- `409` on task save is distinct from generic `500`.

---

## Traceability

| ID    | Primary API                                      | Primary UI                    |
| ----- | ------------------------------------------------ | ----------------------------- |
| US-01 | `POST /api/auth/register`                        | Register                      |
| US-02 | `POST /api/auth/login`, logout, refresh, `/me`   | Login                         |
| US-03 | seed on startup / Flyway callback                | README demo                   |
| US-04 | `/api/workspaces`, `/api/projects`               | Dashboard                     |
| US-05 | `/api/workspaces/{id}/members`                   | Members                       |
| US-06 | `/api/projects/{id}/tasks`, `/api/tasks/{id}`    | Board + task form             |
| US-07 | query params on task list                        | Filters                       |
| US-08 | `PATCH` + `version`                              | Conflict banner               |
| US-09 | `/api/tasks/{id}/comments`                       | Task detail                   |
| US-10 | `/api/audit-events`                              | History                       |
| US-11 | Problem Details + frontend mapping               | All screens                   |
