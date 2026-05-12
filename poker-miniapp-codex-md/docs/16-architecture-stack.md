# 16. Architecture & Stack

## Purpose

Poker Table is a Telegram Mini App for private home poker accounting.

The MVP includes the full documented scope:
- Telegram user bootstrap;
- room creation and invite flow;
- waiting room and room start;
- player and admin rebuy flows;
- rebuy history and audit trail;
- settlement input and balance validation;
- final results and manual transfer instructions;
- global leaderboard;
- "played with me" leaderboard;
- player profile and recent games;
- Telegram bot entry points.

The product boundary is strict: the app is not a casino, payment service, wallet, betting
interface, or money storage system.

## Architecture Goals

1. Keep financial calculations deterministic and testable.
2. Keep all money values as integer minor units.
3. Prevent duplicate rebuy creation on fast taps.
4. Make every financially meaningful action auditable.
5. Keep room privacy enforced on the backend.
6. Keep frontend UI mobile-first and Telegram-friendly.
7. Make the MVP shippable without websockets or overbuilt infrastructure.

## Monorepo Structure

```text
apps/
  web/      # Telegram Mini App frontend
  api/      # NestJS REST API
  bot/      # Telegram Bot API service

packages/
  shared/   # shared DTOs, domain types, validation schemas, money helpers
  config/   # shared environment/config helpers

docs/
  *.md

prompts/
  *.md
```

Use `pnpm` workspaces. Do not change the package manager without an explicit decision.

## Stack

### Frontend

- React
- TypeScript strict mode
- Vite
- React Router
- TanStack Query for server state
- Tailwind CSS
- shadcn/ui
- Zustand or small React context only for session/app UI state
- Vitest for unit tests
- Playwright for smoke tests

### Backend

- NestJS
- TypeScript strict mode
- Prisma
- PostgreSQL
- REST API for MVP
- JWT or backend session token after Telegram initData validation
- Jest for backend unit/integration tests

### Bot

- TypeScript Node service
- Telegram Bot API
- Commands: `/start`, `/help`
- Mini App launch button
- Deep link support through `startapp`

### Database

- PostgreSQL
- Prisma migrations
- Money fields stored as `BigInt`
- API serializes money fields as decimal strings

## Application Boundaries

### `apps/web`

Owns:
- Telegram Mini App UI;
- routing;
- client-side form state;
- server-state fetching and cache invalidation;
- confirmation dialogs;
- local settlement draft calculations for immediate feedback;
- Russian user-facing copy.

Does not own:
- permission decisions;
- final settlement authority;
- trusted Telegram identity;
- irreversible domain state transitions.

### `apps/api`

Owns:
- Telegram initData validation;
- app session issuance;
- room permissions;
- room state transitions;
- rebuy creation/cancellation;
- settlement validation and close transaction;
- leaderboard/profile reads;
- idempotency;
- audit persistence.

### `apps/bot`

Owns:
- Telegram command responses;
- opening the Mini App;
- invite/deep-link routing;
- optional game status messages.

The bot must never contain frontend secrets or database-only business logic.

### `packages/shared`

Owns:
- DTO types;
- shared enums;
- validation schemas;
- money parser/formatter contracts;
- pure calculation functions when they are safe to share.

Backend remains the source of truth for permissions and persistence.

### `packages/config`

Owns:
- environment parsing;
- required variable validation;
- typed config exports.

Secrets must never be exposed to `apps/web`.

## Domain Model

Core entities:
- `User`
- `Room`
- `RoomPlayer`
- `RebuyEvent`
- `IdempotencyKey`
- `Settlement`
- `SettlementTransfer`
- `PlayerStats`

Important domain rules:
- one `RoomPlayer` per `(roomId, userId)`;
- room creator becomes `OWNER`;
- rebuy amount is fixed per room;
- only active rebuy events count toward buy-ins;
- cancelled rebuy events remain in history;
- settlement can close only when final totals equal active buy-ins;
- closed rooms are read-only;
- only closed rooms affect stats and leaderboard.

## Money Representation

Database:

```text
BigInt minor units
```

API:

```json
{
  "rebuyAmountMinor": "100000",
  "netResultMinor": "-450000",
  "differenceMinor": "0"
}
```

Frontend:
- parse `*Minor` strings with shared helpers;
- calculate with `bigint` or safe integer helpers;
- never use floating point for money;
- format money only at the UI layer.

Reason: JSON numbers are unsafe for large integer money values, and JavaScript `bigint`
cannot be serialized directly.

## API Contract Rules

REST is the MVP API style.

Base path:

```text
/api
```

Contract rules:
- all authenticated routes require a valid app session;
- all private room reads require room membership;
- all mutations check role and room status;
- all money fields use string minor units;
- errors use a consistent `{ error: { code, message, details } }` envelope;
- frontend copy maps technical error codes to Russian product text.

## Authentication & Authorization

Telegram user data is trusted only after backend initData validation.

Auth flow:
1. Web app reads Telegram initData.
2. Web app sends initData to `POST /auth/telegram`.
3. API validates hash and freshness.
4. API creates or updates `User`.
5. API returns app session token.
6. Web app uses token for API requests.

Authorization helpers:
- `assertRoomMember(userId, roomId)`
- `assertRoomAdmin(userId, roomId)`
- `assertRoomOwner(userId, roomId)`
- `assertRoomStatus(roomId, expectedStatus)`

## Idempotency

Rebuy creation must be idempotent.

Request:

```json
{
  "roomPlayerId": "rp_1",
  "idempotencyKey": "uuid"
}
```

Backend behavior:
- scope keys by `(userId, action, key)`;
- store request hash and response snapshot;
- return the same response for exact duplicate requests;
- reject same key with different payload as `DUPLICATE_REQUEST`;
- create rebuy and idempotency record in one transaction.

Frontend behavior:
- generate key when confirmation modal opens or before submit;
- disable confirm while pending;
- never rely on UI disabling as the only protection.

## Audit Trail

Do not hard-delete:
- rooms;
- room players;
- rebuy events;
- settlement records;
- transfers.

Auditable actions:
- room created;
- player joined;
- game started;
- rebuy created;
- rebuy cancelled;
- settlement calculated;
- room closed.

MVP can represent room/player lifecycle events either as dedicated audit rows later or as
timestamped state changes plus rebuy history. Rebuy events must be immutable except
cancellation status/timestamps.

## Frontend Architecture

Routes:

```text
/
/create-room
/join/:inviteCode
/rooms/:roomId
/rooms/:roomId/history
/leaderboard
/profile
/players/:userId
```

State:
- TanStack Query for rooms, room details, rebuys, settlement preview, leaderboard, profile;
- local component state for forms, dialogs, selected filters, draft settlement values;
- small session context for authenticated user and token.

React rules:
- avoid component definitions inside components;
- avoid unnecessary effects for derived state;
- use controlled inputs for forms;
- debounce or defer expensive settlement preview calls;
- import directly where possible to control bundle size;
- lazy-load heavy screens only if bundle size requires it.

## UI Direction

Use existing Stitch screens and `premium_fintech_dark_mode/DESIGN.md` as visual references,
not as production code.

Visual thesis:

```text
Quiet dark fintech utility: dense, calm, thumb-friendly, with emerald action states and
clear positive/negative results.
```

UI principles:
- Russian UI copy only;
- mobile-first Telegram viewport;
- dark mode by default;
- no casino styling;
- no payment-service styling;
- main in-game action is visually dominant: `+ Ребай — 1 000 ₽`;
- destructive and financial actions require confirmation;
- minimum 44px touch targets and at least 8px gaps between adjacent controls;
- use icons for compact repeated actions;
- use product text, not internal field names.

Manual transfers are shown as instructions, not payment actions.

## Leaderboard Privacy

MVP includes both:
- `Все игроки`;
- `Играли со мной`.

Global leaderboard is allowed in MVP, but should be implemented with a privacy-ready design:
- backend scope parameter is explicit;
- later hide/visibility preferences can be added without rewriting API shape;
- no public room details are exposed through leaderboard rows.

## Testing Gates

Required checks before accepting each implementation slice:
- typecheck;
- lint;
- unit tests;
- affected integration tests;
- build;
- targeted manual/browser verification for frontend screens.

Critical unit tests:
- money parsing/formatting;
- room status transitions;
- rebuy permissions;
- duplicate rebuy idempotency;
- settlement balance validation;
- transfer optimization;
- leaderboard formulas.

Critical integration tests:
- create room;
- join room;
- start room;
- add rebuy;
- cancel rebuy;
- close settlement;
- leaderboard/profile after closed game.

## Deployment & Config Assumptions

MVP assumes:
- one PostgreSQL database;
- API and bot run server-side;
- web app can be served as static Vite build;
- bot token exists only server-side;
- frontend receives only public Mini App configuration.

Environment variables should be documented in `.env.example` once scaffold exists.

Do not introduce production deployment complexity before Sprint 7 unless required by
Telegram Mini App testing.

## Explicit Non-Goals

Do not implement:
- deposits;
- withdrawals;
- wallets;
- payment processing;
- betting odds;
- rake;
- casino mechanics;
- random rewards;
- public social feed;
- club/season features before MVP is complete.

## Development Ownership Rule

Architecture documents, planning documents, and acceptance criteria are owned by the main
agent.

Application code is implemented by delegated subagents and then reviewed, tested, and either
accepted or rejected by the main agent.
