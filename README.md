# TeamFlow

Compact project/task workspace (React + Spring Boot + PostgreSQL). Stage 1 is a runnable skeleton: schema migrations, health checks, and one-command local start.

## Quick start

```bash
cp .env.example .env
make up
```

- SPA: http://localhost:3000 (proxies `/api` and `/actuator` to the API)
- API health: http://localhost:8080/actuator/health
- Postgres: localhost:5432

Stop with `make down`.

## Tests

```bash
make test
```

Requires Docker (backend tests use Testcontainers PostgreSQL).

## Layout

```
frontend/   Vite + React
backend/    Spring Boot 4, Java 21, Flyway
infra/      Docker Compose
docs/       Stage 0 ADRs, diagrams, OpenAPI
```

Auth (cookie JWT) is specified in [docs/adr/0002-cookie-jwt-auth.md](docs/adr/0002-cookie-jwt-auth.md) and implemented in Stage 2.
