# TaskFlow API

REST API для команд, проектов и задач: JWT, роли на уровне команды и проекта, in-app и email-уведомления, дедлайны через BullMQ, полнотекстовый поиск в PostgreSQL.

## Стек

Node.js 20 · TypeScript (strict) · Express 5 · Prisma · PostgreSQL 16 · Redis · BullMQ · JWT · Zod · Pino · Vitest · OpenAPI 3 · Docker

## Быстрый старт

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run db:migrate:deploy
npm run db:seed
npm run dev          # API :3000
npm run worker       # BullMQ workers
```

- Swagger UI: http://localhost:3000/api-docs  
- Спека: `docs/openapi.yaml`

## Seed-аккаунты

| Email | Пароль |
|-------|--------|
| admin@taskflow.dev | Password123! |
| member@taskflow.dev | Password123! |

## API (основное)

- `POST /api/v1/auth/register`, `GET /api/v1/auth/verify-email`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`
- `GET|PATCH /api/v1/users/me`
- `POST /api/v1/teams`, `POST /api/v1/teams/:id/invite`, `POST /api/v1/teams/invite/:token/accept`
- `DELETE /api/v1/teams/:teamId/members/:userId`, `DELETE /api/v1/teams/:teamId/leave`
- `POST /api/v1/projects/teams/:teamId`, задачи под `/api/v1/tasks/...`
- `GET /api/v1/tasks/search?q=`
- `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`

Полный список — в OpenAPI.

## Структура

```
src/
├── config/
├── modules/          # auth, users, teams, projects, tasks, notifications, queue
├── shared/           # middleware, utils, errors, lib, email
├── routes/v1/
├── app.ts
└── worker.ts
```

Миграции: [docs/MIGRATIONS.md](docs/MIGRATIONS.md)

Воркер `notifications` шлёт напоминания за 24ч и 1ч до дедлайна; раз в неделю чистит просроченные refresh-токены.

## Скрипты

| Команда | |
|---------|--|
| `npm test` | unit + contract; integration при `RUN_INTEGRATION=true` или в CI |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run openapi:validate` | проверка `docs/openapi.yaml` |

```bash
RUN_INTEGRATION=true npm test
```

## Docker

```bash
docker compose up --build
```

MIT
