# TeamFlow — план GitHub-проекта и мастер-промпт

## 1. Цель проекта

Создать небольшой, но production-like full-stack продукт, который демонстрирует не количество технологий, а завершённый инженерный цикл:

- React/TypeScript frontend;
- Java/Spring Boot backend с REST API;
- PostgreSQL и миграции схемы;
- аутентификация, авторизация и роли;
- Docker-контейнеры и локальный запуск одной командой;
- unit, integration и end-to-end тесты;
- GitHub Actions для CI и CD;
- SAST, SCA, container и secret scanning;
- документация архитектуры и инженерных решений.

Главная идея: репозиторий должен позволить интервьюеру за 5–10 минут понять, что автор умеет спроектировать, протестировать, защитить и доставить приложение.

## 2. Концепция продукта

**TeamFlow** — компактная система управления проектами и задачами.

### Основные сценарии

- пользователь регистрируется и входит в систему;
- создаёт рабочее пространство и проект;
- приглашает участника или использует подготовленные demo-аккаунты;
- создаёт, назначает, редактирует и перемещает задачи;
- фильтрует задачи по исполнителю, статусу и приоритету;
- просматривает историю изменений;
- два клиента не могут незаметно перезаписать изменения друг друга.

### Роли

- `ADMIN` — управляет участниками и проектом;
- `MEMBER` — работает с задачами;
- `VIEWER` — только просматривает данные.

### Что намеренно не входит в MVP

- микросервисы;
- Kubernetes;
- собственный OAuth-сервер;
- чат, видеозвонки и сложные realtime-функции;
- десятки экранов и декоративные анимации.

Это защищает проект от переусложнения. Один хорошо построенный modular monolith для портфолио полезнее нескольких формальных микросервисов.

## 3. Рекомендуемый стек

### Frontend

- React + TypeScript + Vite;
- React Router;
- TanStack Query для server state;
- React Hook Form и схема валидации;
- доступные UI-компоненты или небольшая UI-библиотека;
- Vitest + React Testing Library;
- Playwright для E2E.

### Backend

- актуальная LTS Java;
- Spring Boot;
- Spring Web, Validation, Security, Data JPA;
- PostgreSQL;
- Flyway или Liquibase;
- OpenAPI/Swagger;
- JUnit 5, Mockito, Testcontainers;
- structured logging, Actuator/Micrometer.

### Infrastructure

- отдельные Dockerfile для frontend и backend;
- multi-stage builds и non-root runtime users;
- Docker Compose для frontend, backend и PostgreSQL;
- health checks, volumes и `.env.example`;
- reverse proxy только если он действительно нужен;
- публикация versioned images в GitHub Container Registry.

## 4. Архитектурные требования

- Monorepo: `frontend/`, `backend/`, `infra/`, `docs/`.
- Backend — modular monolith по бизнес-функциям, а не единая папка controllers/services/repositories.
- Слои API, application/domain и persistence не должны смешиваться.
- DTO не должны напрямую раскрывать JPA entities.
- RFC 7807 Problem Details или единый эквивалентный формат ошибок.
- Серверная пагинация, фильтрация и сортировка.
- Optimistic locking/version field для защиты от lost update.
- Транзакционные границы должны быть явными.
- OpenAPI-контракт документируется и проверяется в CI.
- Секреты не хранятся в репозитории или Docker images.

## 5. Модель данных

- `users`;
- `workspaces`;
- `workspace_members`;
- `projects`;
- `tasks`;
- `task_comments`;
- `audit_events`.

У задачи: title, description, status, priority, assignee, due date, version, created/updated timestamps. Добавить индексы под реальные фильтры и объяснить их в ADR.

## 6. API и интерфейс

Минимальные endpoint-группы:

- `/api/auth`;
- `/api/workspaces` и участники;
- `/api/projects`;
- `/api/tasks` с пагинацией/фильтрами;
- `/api/tasks/{id}/comments`;
- `/api/audit-events`;
- `/actuator/health`.

Основные экраны:

- login/register;
- dashboard проектов;
- task board или таблица задач;
- форма создания/редактирования;
- история изменений;
- управление участниками для администратора;
- понятные loading, empty, error и forbidden states.

## 7. Безопасность

- безопасная password hashing strategy;
- короткоживущая аутентификационная сессия или access token; выбранную модель обосновать;
- HttpOnly/Secure/SameSite cookies, если используются cookies;
- CSRF-защита для cookie-based auth;
- CORS allowlist;
- проверка прав на уровне ресурса, а не только UI;
- ограничение размера входных данных и bean validation;
- security headers;
- sanitized error responses без stack traces;
- rate limiting для login как улучшение после MVP.

### Автоматические проверки

- **SAST:** CodeQL;
- **SCA:** Dependabot плюс dependency scanner для Java/Node;
- **Secrets:** Gitleaks или эквивалент;
- **Containers/filesystem:** Trivy или эквивалент;
- результаты критичных проверок блокируют merge.

## 8. Тестовая стратегия

Не нужно стремиться к искусственным 100% coverage. Тестировать риски и поведение.

### Backend unit tests

- бизнес-правила и переходы статусов;
- разрешения ролей;
- конфликт версий;
- validation и error mapping.

### Backend integration tests

- PostgreSQL через Testcontainers, а не H2;
- repository queries и migrations;
- REST API + security;
- транзакции и optimistic locking.

### Frontend tests

- формы и validation;
- loading/error/empty states;
- permission-based UI;
- hooks/components с mocked HTTP boundary.

### E2E

- login → создание проекта → создание/назначение задачи;
- viewer не может изменить задачу;
- фильтрация задач;
- обработка конфликтующего обновления;
- тесты работают против полного Docker/production-like стека.

Добавить coverage reports и разумные thresholds только после появления содержательных тестов.

## 9. GitHub Actions: CI/CD

### Pull request CI

1. frontend lint, typecheck, unit tests и build;
2. backend format/static analysis, unit и integration tests, package;
3. проверка миграций и OpenAPI;
4. CodeQL, SCA и secret scan;
5. сборка Docker images;
6. container scan;
7. E2E smoke tests через Docker Compose.

Использовать caching, concurrency cancellation и least-privilege `permissions`. Не запускать одинаковые тяжёлые job несколько раз без необходимости.

### Main/release CD

1. после успешного CI собрать immutable images;
2. присвоить tags по commit SHA и release version;
3. опубликовать images в GHCR;
4. развернуть staging на заранее выбранной платформе;
5. выполнить database migrations отдельным контролируемым шагом;
6. выполнить health check и smoke test;
7. production deployment — через protected environment/manual approval, если он добавлен.

Если публичного hosting пока нет, честно назвать workflow `release`, а не изображать CD. Настоящий CD добавляется после выбора deployment target.

## 10. План реализации

### Этап 0 — дизайн

- user stories и acceptance criteria;
- C4 context/container diagram;
- ER diagram;
- OpenAPI outline;
- ADR: modular monolith, auth model, optimistic locking.

### Этап 1 — skeleton и локальная среда

- monorepo, backend/frontend skeleton;
- PostgreSQL, migrations, Docker Compose;
- health checks и одна команда запуска;
- базовый CI.

### Этап 2 — вертикальный срез

- auth;
- один проект и CRUD задач;
- UI, API, БД и тесты для полного happy path;
- demo seed data.

### Этап 3 — production-like поведение

- роли и resource authorization;
- filters/pagination;
- comments/audit;
- optimistic locking;
- единая обработка ошибок.

### Этап 4 — quality gates

- unit/integration/component/E2E suite;
- SAST/SCA/secrets/container scanning;
- build optimization и coverage reports.

### Этап 5 — delivery и презентация

- GHCR release images;
- staging deployment;
- README, diagrams, ADR и API examples;
- screenshots/GIF и demo credentials;
- GitHub topics, release и clean issue board.

## 11. Definition of Done

- `docker compose up --build` запускает систему с нуля;
- migrations применяются автоматически и предсказуемо;
- demo flow воспроизводится по README;
- CI проходит в чистом checkout;
- критичные security findings отсутствуют или документированы;
- unit, integration и E2E действительно выполняются;
- authorization проверяется backend-тестами;
- images имеют immutable tags и публикуются только после CI;
- README объясняет решения, компромиссы и дальнейшие улучшения;
- нет секретов, сгенерированных binaries и мусора в Git.

## 12. Что должно быть в README

1. краткое описание и screenshot;
2. live demo и demo credentials, если доступны;
3. возможности продукта;
4. architecture diagram;
5. стек и причины выбора;
6. quick start;
7. команды тестов;
8. API documentation;
9. security и CI/CD badges;
10. trade-offs и roadmap;
11. несколько ADR в `docs/adr/`.

## 13. Мастер-промпт для реализации

Скопируйте текст ниже в новую сессию Codex/ChatGPT. Лучше выполнять его по этапам, подтверждая каждый этап тестами и коммитом.

```text
Ты — Senior/Staff Full-Stack Engineer. Создай production-like portfolio project TeamFlow в существующем Git-репозитории. Это компактная система управления проектами и задачами, предназначенная для демонстрации навыков Java, React/TypeScript, API design, PostgreSQL, Docker, тестирования, security и CI/CD.

Перед реализацией:
1. Изучи существующий репозиторий и не перезаписывай пользовательские изменения.
2. Предложи короткий поэтапный план и список ключевых архитектурных решений.
3. Зафиксируй все важные допущения. Если выбор влияет на безопасность, deployment или модель данных, задай вопрос; для мелких решений используй разумный default.
4. Работай вертикальными срезами. Не генерируй весь проект одним огромным недоказанным изменением.

Технологии:
- frontend: React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Vitest, React Testing Library, Playwright;
- backend: актуальная LTS Java, Spring Boot, Spring Web, Validation, Security, Data JPA, OpenAPI, Actuator, JUnit 5, Mockito, Testcontainers;
- database: PostgreSQL и Flyway или Liquibase;
- infrastructure: Docker, Docker Compose, GitHub Actions, GHCR;
- security checks: CodeQL (SAST), Dependabot/dependency scanner (SCA), secret scanning и Trivy-compatible image/filesystem scanning.

Функциональность:
- registration/login/logout;
- workspaces и проекты;
- роли ADMIN, MEMBER, VIEWER;
- CRUD задач, assignee, status, priority и due date;
- comments и audit history;
- server-side pagination/filtering/sorting;
- optimistic locking и понятный ответ при конфликте;
- loading, empty, validation, forbidden и server-error states в UI;
- подготовленные demo accounts и seed data без настоящих секретов.

Архитектурные ограничения:
- monorepo: frontend, backend, infra, docs;
- backend — modular monolith, организованный по бизнес-модулям;
- не раскрывать JPA entities через API;
- единый Problem Details error contract;
- resource-level authorization на backend;
- явные transaction boundaries;
- миграции и индексы под реальные запросы;
- secrets только через environment/secrets management;
- container runtime от non-root user, multi-stage builds и health checks;
- не добавлять Kubernetes и микросервисы без доказанной необходимости.

Тесты:
- unit tests для бизнес-правил, permissions и conflict handling;
- backend integration tests с настоящим PostgreSQL через Testcontainers;
- frontend component tests для форм и основных UI states;
- Playwright E2E для login, project/task creation, role denial, filtering и optimistic-lock conflict;
- не использовать бессмысленные тесты ради coverage; thresholds должны быть реалистичными и обоснованными.

GitHub Actions:
- PR workflow: formatting/lint, typecheck, frontend tests/build, backend unit/integration tests/build, security scans, Docker build/scan и E2E smoke test;
- caching и cancellation для устаревших запусков;
- минимальные permissions и pinned/надёжно зафиксированные actions;
- main/release workflow: immutable images tagged commit SHA/release version и публикация в GHCR;
- deployment добавлять только для реально выбранного target; migrations, health check и smoke test обязательны;
- production environment должен поддерживать approval/rollback strategy.

Документация:
- профессиональный README с screenshot, quick start, demo flow, test commands, architecture, security, CI/CD, trade-offs и roadmap;
- Mermaid C4-подобная context/container diagram и ER diagram;
- OpenAPI UI/spec;
- ADR для modular monolith, auth model и optimistic locking;
- `.env.example`, CONTRIBUTING и Makefile/Taskfile с понятными командами.

Порядок работы:
Этап 0: user stories, acceptance criteria, diagrams, API outline и ADR.
Этап 1: skeleton, DB migration, Compose, health checks и базовый CI.
Этап 2: вертикальный срез auth → project → task через UI/API/DB и тесты.
Этап 3: roles, filters, comments, audit и concurrency conflict.
Этап 4: полная test pyramid и security quality gates.
Этап 5: release images, staging deployment и финальная документация.

После каждого этапа:
- перечисли изменённые файлы и принятые решения;
- запусти релевантные lint/build/tests/scans;
- покажи фактические результаты;
- исправь найденные проблемы;
- предложи conventional commit message;
- остановись и запроси подтверждение перед следующим этапом.

Definition of Done:
- чистый `docker compose up --build` поднимает весь стек;
- CI воспроизводим на clean checkout;
- permissions проверены integration tests;
- основные сценарии покрыты E2E;
- migrations, health checks и release images работают;
- нет committed secrets и необъяснённых critical security findings;
- новый разработчик может запустить demo по README за несколько минут.

Начни с анализа репозитория и Этапа 0. Код пока не пиши, пока не представишь план, структуру и спорные решения.
```

## 14. Как презентовать проект на интервью

Короткая структура рассказа:

1. **Проблема:** небольшим командам нужен простой task workflow с контролем доступа.
2. **Решение:** React SPA + Spring Boot modular monolith + PostgreSQL.
3. **Главное решение:** monolith выбран осознанно для простоты эксплуатации; границы модулей позволяют эволюцию.
4. **Риск:** потеря данных при одновременном редактировании; решён optimistic locking.
5. **Качество:** Testcontainers и Playwright проверяют настоящий интегрированный стек.
6. **Delivery:** Docker images проходят security gates, получают immutable tags и публикуются через GitHub Actions.
7. **Trade-off:** realtime и Kubernetes не добавлены, потому что не оправданы масштабом продукта.

Самый сильный сигнал — быть готовым открыть failed test/security check, объяснить причину и показать, как pipeline предотвращает плохой release.
