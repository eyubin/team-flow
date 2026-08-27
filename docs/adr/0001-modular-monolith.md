# ADR 0001: Modular monolith

- Status: Accepted
- Date: 2026-08-27

## Context

TeamFlow must look production-like on a resume: clear API, PostgreSQL, authz, tests, and CI. It must stay small enough to explain in an interview. Microservices and Kubernetes are explicitly out of MVP scope.

## Decision

Ship **one Spring Boot application** with **package-level modules** (`identity`, `workspace`, `task`, `audit`, `shared`) in a monorepo next to a React SPA.

Rules:

- HTTP, application/domain, and persistence do not mix in the same class.
- JPA entities are not API types.
- Cross-module access goes through application services (or a small port), not repositories of another module.
- One database, Flyway migrations owned by the backend.

## Consequences

Positive:

- One Compose file, one health check, one OpenAPI document, one deployment unit.
- Module folders still show where a microservice boundary *could* form later.
- Transactions and audit-in-the-same-tx stay straightforward.

Negative:

- No independent scaling per module (not needed).
- Discipline is social (reviews, package visibility), not a network boundary.

## Alternatives considered

- **Layered package-by-layer** (`controller/`, `service/`, `repository/`): faster to generate, harder to see bounded contexts.
- **Microservices**: operational overhead without a scale or team-boundary reason.
