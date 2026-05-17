# Миграции базы данных

## Новая установка

```bash
docker compose up -d postgres redis
npm run db:migrate:deploy
npm run db:seed
```

## Обновление существующей БД

```bash
# остановите API и worker
npm run db:migrate:deploy
```

Порядок миграций:

1. `20250517000000_init` — базовая схема
2. `20250517120000_tz_alignment` — `isActive`, `TaskHistory`, GIN для поиска, `NotificationType`, и др.

После миграции при необходимости:

```bash
npm run db:seed
npm run dev
```

## Проверка

```bash
npx prisma migrate status
```
