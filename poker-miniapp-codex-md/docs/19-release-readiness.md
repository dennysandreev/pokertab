# 19. Release Readiness

## Purpose

This checklist defines what must be true before Poker Table is considered ready for
Telegram Mini App MVP testing.

Automated checks can prove that the code compiles and core logic behaves as expected.
They do not replace a real Telegram flow with at least two users and a persistent database.

## Current Automated Gate

Run from the repository root:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pokertable corepack pnpm --dir apps/api prisma:validate
corepack pnpm --dir apps/api prisma:generate
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

The gate is acceptable only when all commands pass.

## Local Smoke Checks

Database setup:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pokertable corepack pnpm --dir apps/api prisma:migrate:deploy
```

For a clean release-readiness run, use an empty PostgreSQL database before applying
migrations.

API smoke:

```text
GET /health
GET /api/leaderboard without token
GET /api/players/:userId/profile without token
```

Expected:
- `/health` returns `{ "ok": true }`;
- private API routes return `UNAUTHORIZED`;
- leaderboard and profile routes are mapped by the API.

Web smoke:
- open `/`;
- open `/rooms/new`;
- open `/leaderboard`;
- open `/players/:userId`;
- verify mobile viewport around `390x844`;
- check browser console for fresh errors or warnings.

Known acceptable local noise:
- missing `/favicon.ico` in Vite dev server.

## MVP API Smoke

After the database is migrated and the API server is running, run:

```text
API_URL=http://localhost:3000 SMOKE_TELEGRAM_BOT_TOKEN=<bot-token> corepack pnpm --dir apps/api smoke:mvp
```

The smoke script:
- creates two temporary Telegram-authenticated users through `POST /api/auth/telegram`;
- creates a room;
- joins the second user;
- starts the room;
- creates rebuys for both players;
- previews and closes settlement;
- verifies the closed room snapshot;
- verifies global leaderboard;
- verifies `Играли со мной` leaderboard;
- verifies player profile access.

The script must not print session tokens or raw Telegram `initData`.

This smoke is not a substitute for the Telegram Mini App manual E2E, but it should pass
before spending time on device testing.

## Telegram Mini App Manual E2E

Use two Telegram users.

Flow:
1. User A opens the Mini App from the bot.
2. User A creates a room.
3. User A shares the invite link.
4. User B joins from the invite.
5. User A starts the game.
6. User A adds a rebuy.
7. User B adds a rebuy if room rules allow it.
8. User A adds or cancels a rebuy as admin.
9. Both users see updated active-room totals.
10. User A enters final amounts.
11. App blocks unbalanced settlement.
12. User A closes a balanced settlement.
13. Both users see final results.
14. Manual transfer instructions are visible as instructions only.
15. Leaderboard updates after the room is closed.
16. `Играли со мной` leaderboard includes only shared closed games.
17. Player profile opens for a shared player.
18. Profile for an unrelated player is blocked with privacy copy.

Acceptance:
- no unhandled UI errors;
- no duplicate rebuy after fast taps;
- cancelled rebuy remains in history but is excluded from totals;
- closed room is read-only;
- browser and Telegram Back Button navigation feel predictable;
- all user-facing copy is Russian.

## Product Boundary Review

The app must remain an accounting tool.

Allowed:
- buy-in and rebuy accounting;
- final result calculation;
- manual transfer instructions;
- leaderboard and profile statistics.

Not allowed:
- internal balances;
- stored funds;
- direct transfer actions;
- payment-style CTAs;
- casino-style mechanics or styling;
- betting odds.

Manual transfer copy must not look like the app processes money.

## Environment Checklist

Required API/Bot environment:
- `DATABASE_URL`;
- `TELEGRAM_BOT_TOKEN`;
- `APP_SESSION_SECRET`;
- `WEB_APP_URL`;
- `BOT_PORT` if the bot service needs a non-default port.

Required Web environment:
- `VITE_API_URL` when API is not available at `http://localhost:3000`.

Rules:
- do not expose server secrets to `apps/web`;
- do not log Telegram `initData`;
- do not log session tokens;
- keep `.env` files out of git.

## Remaining Pre-Release Risks

These are not closed by unit tests alone:
- real Telegram `initData` validation with production bot token;
- Mini App Back Button behavior on iOS and Android Telegram clients;
- multi-user race conditions during fast rebuy and settlement actions;
- visual quality on small Android screens and devices with safe-area insets.

These are closed only after `prisma:migrate:deploy` and `smoke:mvp` pass against a real
database:
- persistent database migrations against a clean database;
- leaderboard/profile behavior on real closed-room data;
- HTTP-level room, rebuy, settlement, leaderboard, and profile contracts.

## Release Candidate Definition

A build can be treated as an MVP release candidate when:
- automated gate passes;
- database migrations apply to a clean database;
- MVP API smoke passes;
- local API and web smoke checks pass;
- Telegram two-user E2E passes;
- no production secrets are present in frontend output;
- no payment/casino semantics are present in UI;
- known risks are either fixed or explicitly accepted.
