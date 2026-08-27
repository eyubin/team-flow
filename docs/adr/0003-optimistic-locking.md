# ADR 0003: Optimistic locking for tasks

- Status: Accepted
- Date: 2026-08-27

## Context

Two clients can open the same task and save. Last-write-wins would drop updates without the user noticing. The product requirement is: concurrent edits are detected and the client is told to reload.

Pessimistic `SELECT FOR UPDATE` on every edit would serialize writes and complicate read-mostly boards.

## Decision

Use **JPA `@Version`** (integer column `tasks.version`) on the `Task` entity.

- `POST` create: `version = 0`.
- `GET` includes `version`.
- `PATCH` **must** send `version` (body field). If it does not match the row, persist throws `ObjectOptimisticLockingFailureException` (or equivalent).
- API maps that to **HTTP 409** RFC 7807, `type` URI `urn:teamflow:problem:optimistic-lock`, with `currentVersion` in extensions (and optionally the current task snapshot).
- Comments do not version the comment row for MVP; adding a comment does not require the task version. Task field updates always do.

Lost update is the risk we optimize for. We do **not** use HTTP `If-Match` / ETags in MVP to keep one obvious contract (`version` in JSON). ETags can be added later without changing the column.

## Consequences

Positive:

- Standard Spring/JPA pattern; easy to test with two updates in one integration test.
- UI can show a dedicated conflict state (US-08).

Negative:

- Clients must round-trip `version`; forgotten field should be `400`, stale field `409`.
- High-contention boards could see more 409s; acceptable at this scale.

## Alternatives considered

- **Last-write-wins:** violates the product story.
- **Pessimistic locking:** worse UX for a kanban board; hold times and deadlocks.
- **CRDT / operational transform:** far beyond MVP.
