# 15. MVP Sprints

## Sprint 0 — Setup

Goal:
Prepare monorepo and basic tooling.

Tasks:
- create pnpm workspace;
- create apps/web;
- create apps/api;
- create apps/bot;
- create packages/shared;
- setup TypeScript;
- setup lint;
- setup format;
- setup test scripts;
- setup Docker Compose for PostgreSQL;
- setup Prisma.

Acceptance:
- `pnpm install` works;
- `pnpm typecheck` works;
- `pnpm test` works;
- empty web app runs;
- empty API health endpoint works.

## Sprint 1 — Auth & user bootstrap

Goal:
User can open Mini App and become authenticated.

Tasks:
- implement Telegram initData validation;
- create/update user;
- issue session token;
- frontend bootstrap;
- Home empty state.

Acceptance:
- user opens app;
- backend creates user;
- Home screen shows user name.

## Sprint 2 — Rooms

Goal:
User can create and join rooms.

Tasks:
- create room endpoint;
- create owner room player;
- generate invite code;
- build Create Room UI;
- build Waiting Room UI;
- build Join Room UI;
- implement join endpoint.

Acceptance:
- room created;
- invite link generated;
- another user joins;
- waiting room shows players.

## Sprint 3 — Start game & active room

Goal:
Admin can start game and players see active room.

Tasks:
- start room endpoint;
- room status transitions;
- active player view;
- active admin view;
- room details endpoint.

Acceptance:
- admin starts game;
- players see running status;
- admin sees admin controls.

## Sprint 4 — Rebuys

Goal:
Players and admin can add/cancel rebuys.

Tasks:
- create rebuy endpoint;
- confirmation modal;
- update totals;
- cancel rebuy endpoint;
- rebuy history screen;
- duplicate click protection.

Acceptance:
- player adds own rebuy;
- admin adds rebuy for player;
- admin cancels rebuy;
- totals and history are correct.

## Sprint 5 — Settlement

Goal:
Admin closes game with final calculation.

Tasks:
- settlement preview endpoint;
- settlement input screen;
- balance validation;
- transfer algorithm;
- close settlement endpoint;
- final results screen.

Acceptance:
- admin enters final amounts;
- invalid settlement cannot close;
- valid settlement closes;
- final ranking and transfer list are correct.

## Sprint 6 — Leaderboard & profile

Goal:
Players see basic statistics.

Tasks:
- stats calculation after room close;
- leaderboard endpoint;
- played-with-me scope;
- leaderboard UI;
- player profile UI.

Acceptance:
- closed games update stats;
- leaderboard displays correct metrics;
- player profile displays recent games.

## Sprint 7 — QA & polish

Goal:
Prepare stable MVP.

Tasks:
- end-to-end smoke tests;
- loading states;
- empty states;
- error states;
- mobile polish;
- Telegram back button handling;
- production config.

Acceptance:
- main flow works on mobile;
- no critical calculation bugs;
- no unhandled errors in happy path.
