# Poker Table

Poker Table is a Telegram Mini App for running offline and online poker games with Telegram authorization, room invites, rebuys, settlement, player profiles, leaderboards, virtual table flow, clubs, and club events.

The repository is a pnpm monorepo with three deployable apps and shared packages:

- `apps/api` - NestJS API, Prisma schema, migrations, game logic, stats, smoke scripts.
- `apps/web` - React/Vite Telegram Mini App frontend.
- `apps/bot` - Telegram bot entrypoint and Mini App launcher.
- `packages/shared` - shared DTOs, constants, and cross-app types.
- `packages/poker-engine` - poker engine primitives for virtual tables.
- `packages/config` - shared TypeScript and ESLint configuration.

## Product Scope

The current app supports:

- Telegram Mini App login through signed `initData`.
- Offline room creation, invite codes, player joining, rebuys, game start, settlement preview, settlement close, and closed-game snapshots.
- Global and played-with-me leaderboards.
- Player profiles with historical offline and virtual poker stats.
- Virtual poker tables with table creation, join flow, actions, hand history, reactions, winner probability visibility, and table stats.
- Poker clubs, club invites, club events, RSVP-style flows, club dashboards, and club-linked rooms.
- Telegram bot `/start`, persistent menu button, and Mini App open buttons.
- Legacy pokerbot import tooling for read-only SQLite source inspection and controlled Postgres import.
- Production smoke scripts for MVP and virtual table flows.
- Lightweight client boot diagnostics for hard-to-reproduce iOS/Telegram WebView loading issues.

## Tech Stack

- Node.js with pnpm workspaces.
- TypeScript across API, web, bot, and packages.
- NestJS API.
- Prisma ORM with PostgreSQL.
- React 19, React Router, Vite, Tailwind CSS.
- Telegram Bot API and Telegram Mini App SDK.
- Docker Compose production deployment.

## Repository Layout

```text
.
├── apps
│   ├── api
│   │   ├── prisma
│   │   │   ├── migrations
│   │   │   └── schema.prisma
│   │   ├── scripts
│   │   └── src
│   ├── bot
│   └── web
├── deploy
│   └── docker-compose.prod.yml
├── packages
│   ├── config
│   ├── poker-engine
│   └── shared
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## Requirements

- Node.js 22 or compatible current LTS.
- Corepack enabled.
- pnpm 10.11.0, managed through `packageManager`.
- PostgreSQL for local API work.
- Telegram bot token for real Mini App auth.

Enable pnpm through Corepack:

```bash
corepack enable
corepack pnpm install
```

## Environment

Copy the example file and fill local values:

```bash
cp .env.example .env
```

Required variables:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pokertable
PORT=3000
BOT_PORT=3100
APP_SESSION_SECRET=change-me-session-secret
APP_SESSION_TTL_SECONDS=604800
TELEGRAM_BOT_TOKEN=change-me-telegram-bot-token
TELEGRAM_BOT_USERNAME=change-me-bot
TELEGRAM_INIT_DATA_MAX_AGE_SECONDS=600
WEB_APP_URL=http://localhost:5173
VITE_API_URL=http://localhost:3000
```

Notes:

- Never commit `.env`, Telegram tokens, session secrets, `DATABASE_URL`, Telegram `initData`, or production dumps.
- `WEB_APP_URL` must match the HTTPS Mini App URL configured in BotFather for production.
- `TELEGRAM_BOT_USERNAME` is used for invite links such as `https://t.me/<bot>/app?startapp=...`.
- `VITE_API_URL` is used by the web build when the API URL is not the same origin.

## Local Development

Install dependencies:

```bash
corepack pnpm install
```

Generate Prisma client:

```bash
corepack pnpm --dir apps/api prisma:generate
```

Apply database migrations:

```bash
DATABASE_URL="$DATABASE_URL" corepack pnpm --dir apps/api prisma:migrate:deploy
```

Run all apps in development mode:

```bash
corepack pnpm dev
```

Common local URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Bot health port: `http://localhost:3100`

## App Commands

Root commands:

```bash
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

API:

```bash
corepack pnpm --dir apps/api test
corepack pnpm --dir apps/api lint
corepack pnpm --dir apps/api typecheck
corepack pnpm --dir apps/api build
corepack pnpm --dir apps/api prisma:validate
corepack pnpm --dir apps/api prisma:migrate:deploy
```

Web:

```bash
corepack pnpm --dir apps/web test
corepack pnpm --dir apps/web lint
corepack pnpm --dir apps/web typecheck
VITE_API_URL=http://localhost:3000 corepack pnpm --dir apps/web build
```

Bot:

```bash
corepack pnpm --dir apps/bot test
corepack pnpm --dir apps/bot lint
corepack pnpm --dir apps/bot typecheck
corepack pnpm --dir apps/bot build
```

Poker engine:

```bash
corepack pnpm --dir packages/poker-engine test
corepack pnpm --dir packages/poker-engine typecheck
corepack pnpm --dir packages/poker-engine build
```

## Database and Migrations

Prisma schema lives in:

```text
apps/api/prisma/schema.prisma
```

Migrations live in:

```text
apps/api/prisma/migrations
```

Before shipping schema changes:

```bash
DATABASE_URL="$DATABASE_URL" corepack pnpm --dir apps/api prisma:migrate:deploy
DATABASE_URL="$DATABASE_URL" corepack pnpm --dir apps/api prisma:validate
```

For production imports or data-changing maintenance, take a database backup first and avoid printing connection strings or user-sensitive data in logs.

## Smoke Tests

MVP offline flow:

```bash
API_URL="https://chipstable.ru" \
SMOKE_TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
corepack pnpm --dir apps/api smoke:mvp
```

Virtual poker flow:

```bash
API_URL="https://chipstable.ru" \
SMOKE_TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
corepack pnpm --dir apps/api smoke:virtual
```

Expected high-level smoke coverage:

- Auth for two Telegram test users.
- Room or virtual table creation.
- Invite-code join flow.
- Game start and actions.
- Rebuys or virtual hand progression where applicable.
- Settlement or table stats where applicable.
- Leaderboard/profile visibility.

Smoke tests create test data. Remove smoke users and smoke games from production only with deliberate, reviewed database commands.

## Legacy Pokerbot Import

The API includes tooling for importing finished history from an older pokerbot SQLite database:

```bash
corepack pnpm --dir apps/api legacy:pokerbot:dry-run
corepack pnpm --dir apps/api legacy:pokerbot:import
```

The import is designed to:

- Read the legacy SQLite source without modifying it.
- Import only finished matches.
- Match users by Telegram ID.
- Create missing users when needed.
- Create deterministic imported room identifiers to avoid duplicates.
- Run the real import in a transaction.

Before running the real import in production, create a Postgres backup and inspect the dry-run report.

## Production Deployment

Production compose file:

```text
deploy/docker-compose.prod.yml
```

Build production images:

```bash
docker compose --env-file .env -p pokertab -f deploy/docker-compose.prod.yml build api web bot
```

Start or restart only Poker Table app services:

```bash
docker compose --env-file .env -p pokertab -f deploy/docker-compose.prod.yml up -d --no-deps api web bot
```

Run migrations in the API container:

```bash
docker exec pokertab-api-1 corepack pnpm --dir apps/api prisma:migrate:deploy
docker exec pokertab-api-1 corepack pnpm --dir apps/api prisma:validate
```

Basic release checks:

```bash
curl -sS https://chipstable.ru/health
curl -sS https://chipstable.ru/api/leaderboard
curl -sS https://chipstable.ru/
```

Expected:

- `/health` returns `{"ok":true}`.
- Private endpoints without a token return `UNAUTHORIZED`.
- HTML points to the current `/assets/index-*.js` bundle.

When deploying on the shared server, do not restart or modify unrelated applications or legacy pokerbot containers.

## Telegram Mini App Setup

Production Telegram setup requires:

- Bot token configured in API and bot env.
- Mini App URL configured in BotFather.
- `WEB_APP_URL` set to the public HTTPS app URL.
- `TELEGRAM_BOT_USERNAME` set if invite links should open the app through `startapp`.

The bot supports:

- `/start` message with a Mini App button.
- Telegram menu button for opening the Mini App.
- Invite launch parameters for rooms, virtual tables, and clubs.

## Client Loading Diagnostics

The web app includes minimal boot beacons for diagnosing hard-to-reproduce loading failures in Safari or Telegram WebView. They intentionally avoid secrets and send only coarse stages such as:

- `body-probe`
- `module-start`
- `react-render-called`
- `session-provider-mounted`
- `launch-data-ready`
- `auth-start`
- `auth-success`
- `home-mounted`
- `window-error`
- `unhandled-rejection`

There are also static debug pages:

- `/static-ok.html` - static HTML without JavaScript.
- `/debug.html` - minimal HTML with minimal JavaScript.
- `/reset.html` - emergency reset page for browser storage/cache troubleshooting.

These pages help distinguish server, asset, JavaScript, cache, and Telegram WebView problems.

## Security Rules

- Do not log Telegram bot tokens.
- Do not log Telegram `initData`.
- Do not log `DATABASE_URL`.
- Do not commit `.env`, dumps, screenshots with private data, or generated temporary logs.
- Keep production maintenance commands narrow and reversible.

## Troubleshooting Checklist

If the Mini App does not load for a user:

1. Check `/health`.
2. Check whether `/`, `/assets/index-*.js`, and `/assets/index-*.css` return `200`.
3. Ask the user to open `/static-ok.html` and `/debug.html`.
4. Inspect sanitized nginx/API logs for boot stages and API statuses.
5. Check whether Telegram auth reaches `POST /api/auth/telegram`.
6. Check iOS/Safari/Telegram version compatibility and cache issues.
7. Try `/reset.html` only as a diagnostic step, not as the normal launch URL.

## Current Production Domain

The current production domain is:

```text
https://chipstable.ru
```

Older references to `pokertab.ru` may exist in historical notes or previous deployment commands. Use `chipstable.ru` for current production checks.
