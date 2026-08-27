# TeamFlow documentation (Stage 0)

Design artifacts. Application code starts in Stage 1.

| Document | Purpose |
| -------- | ------- |
| [User stories](user-stories.md) | MVP scenarios and acceptance criteria |
| [C4 diagrams](diagrams/c4.md) | Context, containers, modules |
| [ER diagram](diagrams/er.md) | Tables, FKs, indexes |
| [OpenAPI outline](openapi.yaml) | REST contract for implementation and later CI |
| [ADR 0001](adr/0001-modular-monolith.md) | One deployable API, packaged by capability |
| [ADR 0002](adr/0002-cookie-jwt-auth.md) | JWT in HttpOnly cookies + CSRF |
| [ADR 0003](adr/0003-optimistic-locking.md) | Task `version` and HTTP 409 |

Product and delivery goals: [github-portfolio-project-plan.md](../github-portfolio-project-plan.md).
