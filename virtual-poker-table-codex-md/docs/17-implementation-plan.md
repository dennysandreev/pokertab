# 17. Implementation Plan

## Phase 1 — Engine foundation

Goal: create pure TypeScript engine with cards, deck, hand evaluator and basic state.

Deliverables:
- cards;
- deck;
- shuffle;
- hand evaluator;
- table/hand state types.

## Phase 2 — Betting rounds

Goal: implement turn order and legal actions.

Deliverables:
- blinds;
- pre-flop order;
- post-flop order;
- legal actions;
- fold/check/call/bet/raise;
- round completion;
- street advancement.

## Phase 3 — All-in and side pots

Goal: complete no-limit betting complexity.

Deliverables:
- all-in;
- side pot calculation;
- showdown with side pots;
- tie split;
- pot awards.

## Phase 4 — Backend persistence/API

Goal: persist virtual tables and hands.

Deliverables:
- Prisma models;
- create/join/start table endpoints;
- action endpoint;
- table state endpoint;
- history endpoint.

## Phase 5 — Timers and bot notifications

Goal: make asynchronous play possible.

Deliverables:
- TurnTimer model;
- timer worker;
- turn notification;
- reminder notification;
- timeout auto-action;
- pause/resume timer behavior.

Operational flags:
- `VIRTUAL_TIMER_WORKER_ENABLED`: timer poller is enabled by default and turns off only when set to `false`.
- `VIRTUAL_TIMER_POLL_INTERVAL_MS`: timer poll interval in milliseconds; defaults to `5000` if empty or invalid.
- `VIRTUAL_TELEGRAM_NOTIFICATIONS_ENABLED`: notifications are disabled only when set to `false`; otherwise they still require `TELEGRAM_BOT_TOKEN`.
- `WEB_APP_URL`: used to build virtual invite links to `/join/virtual/:inviteCode` and Telegram notification buttons to `/virtual/tables/:tableId`.

## Phase 6 — Frontend UI

Goal: playable table in Telegram Mini App.

Deliverables:
- create virtual table screen;
- waiting room;
- main table;
- action buttons;
- raise modal;
- all-in confirmation;
- admin panel;
- sit-out modal;
- hand history.

## Phase 7 — Online stats and filters

Goal: separate offline and online stats.

Deliverables:
- online stats aggregation;
- leaderboard filter All/Offline/Online;
- profile filter All/Offline/Online;
- Online Poker Score.

## Recommended Codex order

1. `CODEX_TASK_01_ENGINE_CORE.md`
2. `CODEX_TASK_02_BETTING_ROUNDS.md`
3. `CODEX_TASK_03_ALL_IN_SIDE_POTS.md`
4. `CODEX_TASK_04_VIRTUAL_TABLE_API.md`
5. `CODEX_TASK_05_TIMERS_BOT_NOTIFICATIONS.md`
6. `CODEX_TASK_06_VIRTUAL_TABLE_UI.md`
7. `CODEX_TASK_07_ONLINE_STATS_LEADERBOARD.md`

Do not start UI before engine tests for betting and side pots pass.

## Backend Done Criteria

Before frontend work starts, the virtual backend is considered ready only when all of the following are green:

1. Shared contract compiles with backend usage:

```text
corepack pnpm --filter @pokertable/shared typecheck
corepack pnpm --filter @pokertable/api typecheck
```

2. Virtual backend lint and tests pass:

```text
corepack pnpm --filter @pokertable/api lint
corepack pnpm --filter @pokertable/api test -- virtual
```

3. Backend build and Prisma validation pass:

```text
corepack pnpm --filter @pokertable/api build
corepack pnpm --filter @pokertable/api prisma:validate
```

4. Virtual smoke flow passes:

```text
corepack pnpm --filter @pokertable/api smoke:virtual
```

5. Contract-level acceptance is covered by automated checks:

- `/api/virtual/tables/:tableId` returns `currentTimer` and only the viewer's `myPrivateCards`;
- `/api/virtual/tables/:tableId/actions` supports idempotent replay by `idempotencyKey`;
- `/api/virtual/tables/:tableId/hands/:handId/history` preserves showdown privacy rules;
- `/api/virtual/tables/:tableId/hands` pagination works with numeric `handNumber` cursor;
- `/api/virtual/leaderboard` pagination works with opaque cursor;
- `/api/virtual/stats/me` returns stable zero-state and populated DTOs;
- finish/cancel behavior matches the contract and cancels unresolved timers correctly.
