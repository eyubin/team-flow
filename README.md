# TeamFlow

Compact project/task workspace (React + Spring Boot + PostgreSQL). Stage 2 currently includes registration, login, logout, and cookie-based session lookup on top of the Stage 1 runnable skeleton.

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

Open http://localhost:3000/auth for the local registration and login flow. The API exposes `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, and `GET /api/auth/csrf`.
