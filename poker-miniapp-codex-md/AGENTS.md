# AGENTS.md — Instructions for Codex

## Project

This repository is a Telegram Mini App for tracking private home poker games.

The app is an accounting and settlement utility. It is not a casino, does not process payments, does not store user funds, and does not provide betting mechanics.

## Product language

User-facing Russian language is required for the MVP. Code, file names, database fields, and API names must be in English.

Use clean and direct UI copy.

## Tech stack

Use this stack unless explicitly changed:

- Monorepo with pnpm workspaces
- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Bot: Telegram Bot API
- Tests:
  - Frontend unit tests: Vitest
  - Backend unit tests: Jest
  - E2E smoke tests: Playwright

## Repository structure

Prefer this structure:

```text
apps/
  web/      # Telegram Mini App frontend
  api/      # NestJS backend
  bot/      # Telegram bot service

packages/
  shared/   # shared types, DTOs, validation schemas
  config/   # shared config utilities

docs/
  *.md
```

## Coding rules

- TypeScript strict mode must be enabled.
- Avoid `any` unless there is a documented reason.
- Use explicit domain types.
- Keep business logic outside React components.
- Put calculations into pure functions with unit tests.
- Keep settlement logic deterministic.
- Never silently mutate financial values.
- Store money in minor units where possible, for example kopecks/cents as integer.
- Do not use floating point arithmetic for money.
- Use backend idempotency for rebuy creation. UI duplicate-click protection is required too, but is not enough by itself.
- Serialize API money fields as decimal strings, even when database values are stored as `BigInt`.

## Product safety rules

Do not implement:
- deposits;
- withdrawals;
- wallets;
- payment processing;
- casino mechanics;
- gambling advertisements;
- random reward mechanics;
- bonuses;
- betting odds;
- rake;
- house balance.

Allowed:
- buy-in/rebuy accounting;
- final result calculation;
- manual transfer instructions between users;
- game history;
- leaderboard;
- private clubs later.

Manual transfer instructions must not look like payment processing. Do not use payment CTAs,
payment icons, wallet language, or deposit/withdrawal language.

## MVP priorities

Implement in this order:

1. User bootstrap from Telegram Mini App.
2. Create room.
3. Join room by invite/deep link.
4. Waiting room.
5. Start room.
6. Add rebuy with confirmation.
7. Admin rebuy management.
8. Rebuy history.
9. Settlement input.
10. Validate settlement balance.
11. Final results.
12. Optimized transfer calculation.
13. Persist game history.
14. Basic leaderboard with both global and played-with-me scopes.

The MVP scope is the full documented MVP. Do not remove leaderboard, profile, Telegram bot,
rebuy history, settlement, or either leaderboard scope to simplify implementation.

## Development workflow

- Architecture, stack, planning, acceptance criteria, and documentation are owned by the main agent.
- Application code must be delegated to subagents unless the user explicitly changes this rule.
- Subagents should run on `gpt-5.4` for implementation tasks.
- The main agent reviews, verifies, accepts, or rejects subagent code changes.
- See `docs/18-agent-workflow.md` for the detailed workflow.

## UI rules

- Mobile-first.
- Telegram Mini App viewport.
- Dark mode by default.
- Large thumb-friendly buttons.
- Main in-game action must be visually dominant:
  `+ Ребай — 1 000 ₽`
- Admin mode must be clearly marked.
- Positive values must be visually distinct from negative values.
- Every destructive or financial action requires confirmation.
- Every rebuy action must be stored in an audit history.

## Testing requirements

Add tests for:
- room state transitions;
- rebuy creation;
- duplicate rebuy prevention;
- admin rebuy cancellation;
- settlement balance validation;
- transfer optimization algorithm;
- leaderboard metric calculations.

## Documentation rules

When implementing a feature, update relevant docs if the behavior changes.

## Before finalizing a task

Run:
- typecheck;
- lint;
- unit tests;
- affected integration tests.

If commands are not available yet, create reasonable scripts in `package.json`.
