# Poker Table — Telegram Mini App

Пакет `.md` файлов для разработки Telegram Mini App через Codex.

## Суть продукта

Poker Table — это Telegram Mini App для учета домашних покерных игр.

Приложение помогает:
- создать покерный стол;
- пригласить игроков;
- фиксировать фиксированные ребаи;
- дать админу полный контроль над комнатой;
- после игры ввести финальные суммы;
- посчитать чистый результат каждого игрока;
- показать, кто кому сколько должен перевести;
- вести историю игр и статистику;
- строить лидерборд.

## Важно

Приложение не является казино, не принимает ставки, не хранит деньги и не проводит платежи. Это учетный инструмент для приватных игр.

## Рекомендуемый стек

- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui
- Telegram: Telegram Mini App SDK / Telegram WebApp API
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Bot: Telegram Bot API
- Tests: Vitest / Playwright / Jest

## Структура файлов

```text
AGENTS.md
README.md

docs/
  00-product-brief.md
  01-mvp-scope.md
  02-user-flows.md
  03-screens-ui-spec.md
  04-roles-permissions.md
  05-domain-model.md
  06-database-prisma.md
  07-api-contracts.md
  08-calculations-settlement.md
  09-leaderboard-statistics.md
  10-telegram-miniapp-bot.md
  11-frontend-implementation.md
  12-backend-implementation.md
  13-testing-acceptance.md
  14-security-privacy-compliance.md
  15-mvp-sprints.md
  16-architecture-stack.md
  17-development-plan.md
  18-agent-workflow.md

prompts/
  CODEX_INITIAL_PROMPT.md
  CODEX_TASK_01_SCAFFOLD.md
  CODEX_TASK_02_ROOMS.md
  CODEX_TASK_03_REBUYS.md
  CODEX_TASK_04_SETTLEMENT.md
  CODEX_TASK_05_LEADERBOARD.md
```

## Как использовать с Codex

1. Создать пустой репозиторий.
2. Скопировать в корень файлы `README.md`, `AGENTS.md`, папки `docs/` и `prompts/`.
3. Открыть проект в Codex.
4. Начать с промпта `prompts/CODEX_INITIAL_PROMPT.md`.
5. Далее выполнять задачи последовательно:
   - scaffold;
   - комнаты;
   - ребаи;
   - расчет итогов;
   - лидерборд.

Перед стартом разработки обязательно прочитать:
- `docs/16-architecture-stack.md`
- `docs/17-development-plan.md`
- `docs/18-agent-workflow.md`

## Главный принцип разработки

Сначала делаем стабильный MVP:

```text
Комната → участники → ребаи → финальные суммы → расчет переводов → история игры
```

Лидерборд, профиль и оба режима рейтинга входят в MVP. Их можно делать после основного
игрового сценария, но нельзя исключать из MVP.
