COMPOSE := docker compose --env-file .env -f infra/docker-compose.yml

.PHONY: help env up down logs ps test backend-test frontend-test frontend-install e2e

help:
	@echo "make up              Build and start Postgres, API, and SPA"
	@echo "make down            Stop the stack (keeps the database volume)"
	@echo "make test            Backend + frontend tests"
	@echo "make backend-test    Spring Boot tests (Testcontainers)"
	@echo "make frontend-test   Lint, unit tests, typecheck, build"
	@echo "make e2e             Playwright E2E tests against a live Compose stack"

env:
	@test -f .env || cp .env.example .env

up: env
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

test: backend-test frontend-test

backend-test:
	cd backend && ./mvnw -B verify

frontend-install:
	cd frontend && npm ci

frontend-test:
	cd frontend && npm run lint && npm run typecheck && npm test && npm run build

e2e: env
	$(COMPOSE) up --build -d --wait
	(cd frontend && npm ci && npx playwright install --with-deps chromium && npx playwright test); \
	status=$$?; \
	$(COMPOSE) down -v; \
	exit $$status
