# 19. Backend Release Checklist

Чеклист для серверного агента перед релизом Virtual Poker backend.

## Обязательные env

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `WEB_APP_URL`
- `TELEGRAM_BOT_USERNAME`

Опционально, если нужны отдельные значения для smoke/release:

- `API_URL`
- `SMOKE_TELEGRAM_BOT_TOKEN`
- `VIRTUAL_TIMER_WORKER_ENABLED`
- `VIRTUAL_TIMER_POLL_INTERVAL_MS`
- `VIRTUAL_TELEGRAM_NOTIFICATIONS_ENABLED`

## Подготовка БД

1. Применить миграции:

```bash
corepack pnpm --dir apps/api prisma:migrate:deploy
```

2. Проверить Prisma schema:

```bash
corepack pnpm --dir apps/api prisma:validate
```

## Health checks

1. Проверить health endpoint:

```bash
curl -sS http://127.0.0.1:3000/health
```

Если API слушает другой адрес или порт, заменить URL на актуальный production/staging endpoint.

## Smoke checks

1. MVP smoke:

```bash
corepack pnpm --dir apps/api smoke:mvp
```

2. Virtual Poker smoke:

```bash
corepack pnpm --dir apps/api smoke:virtual
```

Убедиться, что virtual smoke проходит сценарии:

- auth пользователей;
- create / join / start;
- table state privacy и `currentTimer`;
- action loop до завершения раздачи;
- hand history и pagination списка;
- online leaderboard и stats;
- next hand;
- pause / resume;
- raise blinds;
- sit-out request;
- finish / cancel;
- rejection action после finish.

## Telegram bot checks

Проверить руками или отдельным smoke:

- `/start`
- открытие web app из меню
- invite/deep link на virtual table
- turn notification
- reminder notification

## Logs checks

После smoke и базовых bot checks посмотреть логи API и bot:

- нет необработанных exception;
- нет Prisma migration/runtime errors;
- нет failed timer jobs;
- нет repeated/idempotency conflicts, кроме ожидаемых в smoke;
- нет 5xx на `/health`, auth и virtual endpoints.

Минимум проверить:

- API logs
- bot logs
- worker/timer logs, если вынесены отдельно
