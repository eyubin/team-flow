# TeamFlow — GitHub Portfolio Project Plan and Master Prompt

## 1. Project Goal

Build a small but production-like full-stack product that demonstrates a complete engineering lifecycle rather than a random collection of technologies:

- React/TypeScript frontend;
- Java/Spring Boot backend with a REST API;
- PostgreSQL with schema migrations;
- authentication, authorization, and roles;
- Docker containers and one-command local startup;
- unit, integration, and end-to-end tests;
- GitHub Actions for CI and CD;
- SAST, SCA, container, and secret scanning;
- architecture and engineering-decision documentation.

The repository should let an interviewer understand within 5–10 minutes that its author can design, test, secure, and deliver an application.

## 2. Product Concept

**TeamFlow** is a compact project and task management system.

### Core scenarios

- A user registers and signs in.
- The user creates a workspace and project.
- The user invites members or uses prepared demo accounts.
- Members create, assign, edit, and move tasks.
- Users filter tasks by assignee, status, and priority.
- Users review the change history.
- Two clients cannot silently overwrite each other's changes.

### Roles

- `ADMIN` — manages the project and members.
- `MEMBER` — works with tasks.
- `VIEWER` — has read-only access.

### Deliberately excluded from the MVP

- microservices;
- Kubernetes;
- a custom OAuth server;
- chat, video calls, and complex real-time features;
- dozens of screens and decorative animations.

This keeps the scope under control. A well-designed modular monolith is more valuable in a portfolio than several artificial microservices.

## 3. Recommended Technology Stack

### Frontend

- React, TypeScript, and Vite;
- React Router;
- TanStack Query for server state;
- React Hook Form with schema-based validation;
- an accessible component library or a small custom design system;
- Vitest and React Testing Library;
- Playwright for E2E tests.

### Backend

- a current Java LTS release;
- Spring Boot;
- Spring Web, Validation, Security, and Data JPA;
- PostgreSQL;
- Flyway or Liquibase;
- OpenAPI/Swagger;
- JUnit 5, Mockito, and Testcontainers;
- structured logging and Actuator/Micrometer.

### Infrastructure

- separate Dockerfiles for frontend and backend;
- multi-stage builds and non-root runtime users;
- Docker Compose for frontend, backend, and PostgreSQL;
- health checks, persistent volumes, and `.env.example`;
- a reverse proxy only if it serves a real purpose;
- versioned images published to GitHub Container Registry.

## 4. Architecture Requirements

- Monorepo structure: `frontend/`, `backend/`, `infra/`, and `docs/`.
- The backend is a modular monolith organized by business capability rather than one global controllers/services/repositories structure.
- API, application/domain, and persistence concerns must remain separate.
- API DTOs must not directly expose JPA entities.
- Use RFC 7807 Problem Details, or an equivalent consistent error format.
- Implement server-side pagination, filtering, and sorting.
- Use optimistic locking/version fields to prevent lost updates.
- Define transaction boundaries explicitly.
- Document and validate the OpenAPI contract in CI.
- Never store secrets in the repository or Docker images.

## 5. Data Model

- `users`;
- `workspaces`;
- `workspace_members`;
- `projects`;
- `tasks`;
- `task_comments`;
- `audit_events`.

A task contains a title, description, status, priority, assignee, due date, version, and created/updated timestamps. Add indexes for real filter patterns and explain them in an ADR.

## 6. API and User Interface

Minimum endpoint groups:

- `/api/auth`;
- `/api/workspaces` and workspace members;
- `/api/projects`;
- `/api/tasks` with pagination and filters;
- `/api/tasks/{id}/comments`;
- `/api/audit-events`;
- `/actuator/health`.

Main screens:

- login and registration;
- project dashboard;
- task board or task table;
- create/edit task form;
- change history;
- admin member management;
- clear loading, empty, error, and forbidden states.

## 7. Security

- Use a secure password-hashing strategy.
- Use either short-lived access tokens or secure server-side sessions, and document the choice.
- If cookies are used, configure HttpOnly, Secure, and SameSite correctly.
- Enable CSRF protection for cookie-based authentication.
- Use a strict CORS allowlist.
- Enforce resource-level permissions on the backend, not only in the UI.
- Validate and limit input sizes.
- Set appropriate security headers.
- Do not expose stack traces in API responses.
- Add login rate limiting after the MVP.

### Automated security checks

- **SAST:** CodeQL;
- **SCA:** Dependabot plus dependency scanning for Java and Node.js;
- **Secrets:** Gitleaks or an equivalent tool;
- **Containers/filesystem:** Trivy or an equivalent scanner;
- critical failures must block merging.

SCA means Software Composition Analysis: detecting known vulnerabilities in third-party dependencies. SAST means Static Application Security Testing: analyzing the application's source code for security problems.

## 8. Testing Strategy

Do not chase an artificial 100% coverage number. Test risks and observable behavior.

### Backend unit tests

- business rules and status transitions;
- role permissions;
- version conflicts;
- validation and error mapping.

### Backend integration tests

- PostgreSQL through Testcontainers rather than H2;
- repository queries and migrations;
- REST API and security rules;
- transactions and optimistic locking.

### Frontend tests

- forms and validation;
- loading, error, and empty states;
- permission-based UI behavior;
- hooks and components with a mocked HTTP boundary.

### E2E tests

- sign in → create a project → create and assign a task;
- a viewer cannot modify a task;
- task filtering;
- conflicting-update handling;
- run against the complete production-like Docker stack.

Add coverage reports and reasonable thresholds only after meaningful tests exist.

## 9. GitHub Actions CI/CD

### Pull-request CI

1. Frontend linting, type checking, unit tests, and build.
2. Backend formatting/static analysis, unit and integration tests, and packaging.
3. Migration and OpenAPI checks.
4. CodeQL, SCA, and secret scanning.
5. Docker image builds.
6. Container scanning.
7. E2E smoke tests through Docker Compose.

Use caching, concurrency cancellation, and least-privilege workflow permissions. Avoid running the same expensive jobs more than necessary.

### Main/release CD

1. Build immutable images after CI succeeds.
2. Tag them with the commit SHA and release version.
3. Publish the images to GHCR.
4. Deploy to staging on the selected platform.
5. Run database migrations as a controlled step.
6. Run health checks and smoke tests.
7. If production is included, use a protected environment and manual approval.

If no public hosting target has been selected, call the workflow `release`, not `CD`. Real continuous delivery begins only after a deployment target exists.

## 10. Implementation Plan

### Phase 0 — Design

- user stories and acceptance criteria;
- C4 context/container diagram;
- ER diagram;
- OpenAPI outline;
- ADRs for modular monolith, authentication, and optimistic locking.

### Phase 1 — Skeleton and local environment

- monorepo with backend/frontend skeletons;
- PostgreSQL, migrations, and Docker Compose;
- health checks and one-command startup;
- basic CI.

### Phase 2 — Vertical slice

- authentication;
- one project and task CRUD;
- UI, API, database, and tests for the full happy path;
- demo seed data.

### Phase 3 — Production-like behavior

- roles and resource-level authorization;
- filters and pagination;
- comments and audit history;
- optimistic locking;
- consistent error handling.

### Phase 4 — Quality gates

- unit, integration, component, and E2E suites;
- SAST, SCA, secret, and container scanning;
- build optimization and coverage reports.

### Phase 5 — Delivery and presentation

- GHCR release images;
- staging deployment;
- README, diagrams, ADRs, and API examples;
- screenshots or a short GIF and demo credentials;
- GitHub topics, release, and a clean issue board.

## 11. Definition of Done

- `docker compose up --build` starts the system from a clean state.
- Migrations are applied automatically and predictably.
- The demo flow can be reproduced by following the README.
- CI passes on a clean checkout.
- Critical security findings are absent or explicitly documented.
- Unit, integration, and E2E tests really execute in CI.
- Backend integration tests verify authorization.
- Images use immutable tags and are published only after CI succeeds.
- The README explains decisions, trade-offs, and future improvements.
- The repository contains no secrets, generated binaries, or unrelated files.

## 12. README Structure

1. Short description and screenshot.
2. Live demo and demo credentials, if available.
3. Product features.
4. Architecture diagram.
5. Technology choices and their rationale.
6. Quick start.
7. Test commands.
8. API documentation.
9. Security and CI/CD badges.
10. Trade-offs and roadmap.
11. ADR links from `docs/adr/`.

## 13. Master Implementation Prompt

Copy the prompt below into a new Codex/ChatGPT session. Execute it phase by phase, validating each phase with tests and a commit.

```text
You are a Senior/Staff Full-Stack Engineer. Build a production-like portfolio project named TeamFlow in the existing Git repository. TeamFlow is a compact project and task management system designed to demonstrate Java, React/TypeScript, API design, PostgreSQL, Docker, testing, security, and CI/CD skills.

Before implementation:
1. Inspect the existing repository and preserve all user changes.
2. Propose a concise phased plan and list the key architecture decisions.
3. State important assumptions. Ask a question when a choice materially affects security, deployment, or the data model; use a sensible default for minor decisions.
4. Work in vertical slices. Do not generate the entire project as one large, unverified change.

Technology stack:
- Frontend: React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Vitest, React Testing Library, and Playwright.
- Backend: a current Java LTS release, Spring Boot, Spring Web, Validation, Security, Data JPA, OpenAPI, Actuator, JUnit 5, Mockito, and Testcontainers.
- Database: PostgreSQL with Flyway or Liquibase.
- Infrastructure: Docker, Docker Compose, GitHub Actions, and GHCR.
- Security checks: CodeQL for SAST, Dependabot/dependency scanning for SCA, secret scanning, and Trivy-compatible image/filesystem scanning.

Required functionality:
- registration, login, and logout;
- workspaces and projects;
- ADMIN, MEMBER, and VIEWER roles;
- task CRUD with assignee, status, priority, and due date;
- comments and audit history;
- server-side pagination, filtering, and sorting;
- optimistic locking with a clear conflict response;
- loading, empty, validation, forbidden, and server-error states in the UI;
- prepared demo accounts and seed data without real secrets.

Architecture constraints:
- Use a monorepo with frontend, backend, infra, and docs directories.
- Build the backend as a modular monolith organized by business capability.
- Never expose JPA entities directly through the API.
- Use a consistent Problem Details error contract.
- Enforce resource-level authorization on the backend.
- Define explicit transaction boundaries.
- Add migrations and indexes based on real queries.
- Store secrets only through environment variables or a secrets manager.
- Use non-root runtime users, multi-stage Docker builds, and health checks.
- Do not add Kubernetes or microservices without a demonstrated need.

Testing requirements:
- Unit tests for business rules, permissions, and conflict handling.
- Backend integration tests against real PostgreSQL through Testcontainers.
- Frontend component tests for forms and important UI states.
- Playwright E2E tests for login, project/task creation, role denial, filtering, and an optimistic-lock conflict.
- Do not create meaningless tests merely to increase coverage. Any threshold must be realistic and justified.

GitHub Actions requirements:
- PR workflow: formatting/linting, type checking, frontend tests/build, backend unit/integration tests/build, security scans, Docker build/scan, and an E2E smoke test.
- Add caching and cancellation for obsolete workflow runs.
- Use minimal permissions and securely pinned, reputable actions.
- Main/release workflow: immutable images tagged with commit SHA/release version and published to GHCR.
- Add deployment only for a real selected target; database migration, health-check, and smoke-test steps are mandatory.
- A production environment must have an approval and rollback strategy.

Documentation requirements:
- A professional README containing a screenshot, quick start, demo flow, test commands, architecture, security, CI/CD, trade-offs, and roadmap.
- Mermaid context/container and ER diagrams.
- OpenAPI UI/specification.
- ADRs for the modular monolith, authentication model, and optimistic locking.
- `.env.example`, CONTRIBUTING, and a Makefile or Taskfile with clear commands.

Execution order:
Phase 0: user stories, acceptance criteria, diagrams, API outline, and ADRs.
Phase 1: skeleton, database migration, Compose, health checks, and basic CI.
Phase 2: authentication → project → task vertical slice through UI/API/database and tests.
Phase 3: roles, filters, comments, audit history, and concurrency conflicts.
Phase 4: complete test pyramid and security quality gates.
Phase 5: release images, staging deployment, and final documentation.

After each phase:
- list changed files and decisions;
- run the relevant lint, build, tests, and scans;
- show the actual results;
- fix detected problems;
- suggest a Conventional Commit message;
- stop and ask for confirmation before moving to the next phase.

Definition of Done:
- A clean `docker compose up --build` starts the complete stack.
- CI is reproducible from a clean checkout.
- Integration tests verify permissions.
- E2E tests cover the main user journeys.
- Migrations, health checks, and release images work.
- No committed secrets or unexplained critical security findings exist.
- A new developer can launch the demo from the README within a few minutes.

Begin by inspecting the repository and completing Phase 0. Do not write implementation code until you have presented the plan, proposed structure, and disputed decisions.
```

## 14. How to Present the Project in an Interview

Use this short structure:

1. **Problem:** Small teams need a simple task workflow with access control.
2. **Solution:** React SPA + Spring Boot modular monolith + PostgreSQL.
3. **Main decision:** A monolith was selected deliberately for operational simplicity; clear module boundaries leave room for future evolution.
4. **Risk:** Concurrent edits could lose data; optimistic locking prevents silent overwrites.
5. **Quality:** Testcontainers and Playwright verify the real integrated stack.
6. **Delivery:** Docker images pass security gates, receive immutable tags, and are published by GitHub Actions.
7. **Trade-off:** Real-time features and Kubernetes were excluded because the project's scale does not justify them.

The strongest signal is being able to open a failed test or security check, explain its cause, and show how the pipeline prevents a faulty release.
