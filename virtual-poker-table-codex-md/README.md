# Virtual Poker Table v1 — Codex Documentation Pack

Пакет `.md` файлов для разработки второй крупной итерации приложения: **виртуальный асинхронный покерный стол Texas Hold’em внутри Telegram Mini App**.

## Контекст

Первая часть продукта — учет офлайн-покера: комнаты, ребаи, финальные расчеты, переводы и офлайн-лидерборд.

Вторая крупная итерация — **Virtual Table**:
- полноценный Texas Hold’em внутри Mini App;
- до 9 игроков;
- виртуальные фишки без денег;
- асинхронные ходы;
- уведомления через Telegram-бота;
- all-in;
- side pots;
- sit-out;
- auto-check / auto-fold;
- статистика онлайн-игр.

## Важная граница продукта

В приложении **нет денег внутри системы**:
- нет депозитов;
- нет выводов;
- нет платежей;
- нет кошельков;
- нет приема ставок;
- нет комиссии/рейка.

Админ может указать **стоимость одной фишки**, но это только справочный параметр для отображения эквивалента результата. Приложение не проводит расчеты деньгами.

## Рекомендуемый стек

- Monorepo: pnpm workspaces
- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Bot: Telegram Bot API
- Engine: чистые TypeScript-модули в `packages/poker-engine`
- Tests: Vitest/Jest для engine, Playwright для UI-smoke

## Как использовать

1. Скопировать пакет в корень проекта.
2. Передать Codex `AGENTS.md`.
3. Начать с `prompts/CODEX_VIRTUAL_INITIAL_PROMPT.md`.
4. Далее выполнять задачи по порядку: engine → betting → side pots → API → timers/bot → UI → stats.
