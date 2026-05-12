# 17. Development Plan

## Planning Principle

MVP means the full documented MVP, not a reduced prototype.

The project is complete only when these flows work end to end:

```text
Telegram launch
→ create room
→ invite/join players
→ waiting room
→ start game
→ player/admin rebuys
→ rebuy history
→ settlement input
→ balance validation
→ final results
→ manual transfer instructions
→ saved history
→ global leaderboard
→ played-with-me leaderboard
→ player profile
```

## Delivery Model

The main agent owns:
- architecture documents;
- implementation planning;
- task decomposition;
- subagent prompts;
- code review;
- verification;
- final acceptance.

Subagents own:
- application code implementation;
- scoped file changes;
- local tests for their slice;
- concise implementation reports.

Application code should be delegated to subagents running `gpt-5.4`.

## Required Skills During Development

Use these skills as part of implementation and review:

- `frontend-skill`: visual direction, UI hierarchy, motion restraint, app surface quality.
- `content-design`: Russian product copy, errors, confirmations, empty states, labels.
- `build-web-apps:react-best-practices`: React performance and data-fetching patterns.
- `ui-ux-pro-max`: design-system guidance, accessibility, mobile/touch rules.
- `systematic-debugging`: any bug, test failure, build failure, or unexpected behavior.

## Sprint 0 — Scaffold

Goal: prepare the monorepo and baseline tooling.

Backend/API:
- create `apps/api`;
- initialize NestJS;
- add `GET /health`;
- add Prisma package setup;
- prepare PostgreSQL connection config.

Frontend:
- create `apps/web`;
- initialize React + Vite + TypeScript;
- add Tailwind;
- add shadcn/ui foundation;
- add blank app shell.

Bot:
- create `apps/bot`;
- add minimal TypeScript entrypoint;
- add placeholder health/log startup behavior.

Shared:
- create `packages/shared`;
- create `packages/config`;
- add shared TypeScript config.

Infra/tooling:
- create `pnpm-workspace.yaml`;
- add root `package.json`;
- add root scripts: `dev`, `build`, `typecheck`, `lint`, `test`;
- add Docker Compose for PostgreSQL;
- add `.env.example`;
- add formatting/lint baseline.

Acceptance:
- `pnpm install` works;
- `pnpm typecheck` works;
- `pnpm test` works;
- web app starts;
- API starts;
- `GET /health` returns `{ "ok": true }`.

Main-agent review:
- verify no product features were overbuilt;
- verify TypeScript strict mode;
- verify no secrets in frontend config.

## Sprint 1 — Telegram Auth & Bootstrap

Goal: user opens Mini App and becomes authenticated.

Backend:
- implement Telegram initData validation;
- create/update `User`;
- issue backend session token;
- add auth guard/current user decorator;
- add safe error format.

Frontend:
- read Telegram WebApp initData;
- call `POST /auth/telegram`;
- store token in session app state;
- parse `start_param`;
- render Home empty state.

Bot:
- implement `/start`;
- implement `/help`;
- add Mini App open button.

Shared:
- define auth DTOs and user DTOs;
- add validation schemas if used.

Acceptance:
- repeat launch does not duplicate user;
- changed Telegram name updates user fields;
- start param with room invite routes toward join flow;
- Home shows Russian user-facing text.

Checks:
- auth unit tests;
- API integration test for create/update user;
- frontend bootstrap smoke test.

## Sprint 2 — Rooms & Invite Flow

Goal: users can create rooms and join by invite.

Backend:
- add `User`, `Room`, `RoomPlayer` Prisma models;
- implement room creation transaction;
- generate high-entropy invite code;
- implement room list/details;
- implement join endpoint;
- implement start endpoint with at least two active players;
- enforce owner/admin permissions.

Frontend:
- Home screen with active/recent games;
- Create Room screen;
- Waiting Room screen;
- Join Room screen;
- route by invite code;
- Russian form labels, placeholders, validation messages.

Bot:
- generate/share Mini App deep-link format.

Acceptance:
- owner creates room and becomes first player;
- invite code exists;
- second user joins;
- duplicate join returns existing membership;
- closed room cannot be joined;
- owner can start game only with at least two active players.

Checks:
- room status transition tests;
- create/join/start integration tests;
- mobile visual check for key screens.

## Sprint 3 — Active Room

Goal: running rooms show correct player/admin surfaces.

Backend:
- expand room details response with totals;
- calculate active rebuy totals from events;
- enforce room member read access.

Frontend:
- Active Room Player view;
- Active Room Admin view;
- player list with buy-ins;
- admin mode visual marker;
- route room status to correct screen;
- polling/refetch every 5-10 seconds while running.

Acceptance:
- players see running status and own totals;
- owner/admin sees admin controls;
- non-admin does not see admin-only actions;
- bottom nav behavior matches active-room UX.

Checks:
- room details tests;
- frontend route/state smoke checks.

## Sprint 4 — Rebuys & Audit History

Goal: player/admin can add and cancel rebuys safely.

Backend:
- add `RebuyEvent`;
- add `IdempotencyKey`;
- implement create rebuy;
- implement cancel rebuy;
- implement rebuy history;
- enforce fixed room rebuy amount;
- enforce self/admin rules;
- enforce running-room status;
- return stable duplicate responses for same idempotency key.

Frontend:
- player rebuy confirmation modal;
- admin add rebuy confirmation;
- admin cancel rebuy flow;
- rebuy history screen;
- disable pending buttons;
- generate idempotency keys;
- show user-friendly errors.

Acceptance:
- player can add own rebuy;
- player cannot add rebuy for another player;
- admin can add rebuy for any active player;
- admin can cancel rebuy;
- cancelled rebuy stays visible in history;
- totals exclude cancelled events;
- duplicate fast taps do not create duplicate rebuys.

Checks:
- idempotency unit/integration tests;
- rebuy permission tests;
- history API tests;
- manual mobile check of modal flows.

## Sprint 5 — Settlement & Final Results

Goal: admin closes a balanced game and everyone sees final results.

Backend:
- add `Settlement`;
- add `SettlementTransfer`;
- implement pure calculation functions:
  - `calculatePlayerNetResults`;
  - `validateSettlementBalance`;
  - `calculateTransfers`;
- implement settlement preview;
- implement settlement close transaction;
- update room players final/net values;
- create settlement snapshot;
- create transfer rows;
- set room status to `CLOSED`;
- trigger stats recalculation.

Frontend:
- Settlement Input screen;
- controlled money inputs;
- local difference calculation;
- preview after debounce or submit;
- disabled close action when unbalanced;
- Final Results screen;
- ranking;
- manual transfer list;
- highlight current user.

Acceptance:
- missing final amount rejected;
- negative final amount rejected unless explicitly changed later;
- unbalanced settlement cannot close;
- balanced settlement closes;
- transfers satisfy all winners and losers;
- closed room is read-only;
- final results are visible to room players.

Checks:
- calculation unit tests;
- settlement integration tests;
- final-results visual/mobile smoke test.

## Sprint 6 — Leaderboard & Profile

Goal: completed games update statistics and rankings.

Backend:
- add/finalize `PlayerStats`;
- calculate stats after room close;
- implement `GET /leaderboard`;
- implement `GET /players/:userId/profile`;
- support scopes:
  - `all`;
  - `played-with-me`;
- support periods:
  - `all-time`;
  - `month`;
  - `last-10`;
- exclude unrelated users from played-with-me;
- exclude cancelled/unclosed rooms from stats.

Frontend:
- Leaderboard screen;
- tabs: `Все игроки`, `Играли со мной`;
- period filters;
- leaderboard rows;
- profile screen;
- recent games.

Acceptance:
- global leaderboard works;
- played-with-me leaderboard works;
- closed games update stats;
- unclosed/cancelled rooms do not affect stats;
- ranking defaults to Poker Score;
- profile displays correct aggregate metrics and recent games.

Checks:
- stats formula unit tests;
- leaderboard scope integration tests;
- profile integration tests;
- copy review for privacy-sensitive labels.

## Sprint 7 — QA, Polish & Release Readiness

Goal: make the MVP stable enough to test as a Telegram Mini App.

Frontend:
- loading states;
- empty states;
- error states;
- Telegram Back Button behavior;
- safe-area handling;
- responsive verification at common mobile widths;
- accessible focus/touch states;
- remove English prototype copy.

Backend:
- audit error mapping;
- rate limit sensitive endpoints if needed;
- validate max title/amount boundaries;
- check logs for token/initData leakage.

Bot:
- verify deep links;
- verify Mini App button;
- verify final result/share copy if enabled.

E2E:
- user creates room;
- second user joins;
- owner starts game;
- both add rebuys;
- owner cancels one rebuy;
- owner enters final amounts;
- settlement closes;
- final results appear;
- leaderboard updates.

Acceptance:
- main flow works on mobile;
- no critical calculation bugs;
- no unhandled errors in happy path;
- no payment/casino UI semantics;
- all user-facing UI copy is Russian.

## Delegation Order

Recommended subagent slicing:

1. Scaffold worker: root tooling and app shells.
2. API worker: auth/user/rooms backend.
3. Web worker: auth/home/create/join/waiting UI.
4. API worker: rebuys/idempotency/history.
5. Web worker: active room/rebuy/history UI.
6. API worker: settlement calculations and close.
7. Web worker: settlement/final results UI.
8. API worker: stats/leaderboard/profile.
9. Web worker: leaderboard/profile UI.
10. QA worker: E2E smoke and regression checks.

Use disjoint write sets when parallelizing. Do not assign two workers to edit the same files
unless the second task is explicitly an integration/review task.

## Definition of Ready

A task is ready for a subagent when it has:
- exact scope;
- files or module ownership;
- docs to read;
- expected endpoints/components/tests;
- acceptance criteria;
- forbidden changes;
- validation commands.

## Definition of Done

A task is done only when:
- implementation matches docs;
- user-facing text is Russian;
- no payment/casino semantics were introduced;
- relevant tests were added or updated;
- `typecheck`, `lint`, tests, and build pass where available;
- main agent reviewed the diff;
- main agent accepts the result.

## Debugging Protocol

For any bug, failing check, or unexpected behavior:

1. Read the exact error.
2. Reproduce consistently.
3. Check recent changes.
4. Trace the failing data path.
5. Compare with working patterns.
6. State one hypothesis.
7. Test the smallest change.
8. Fix only after root cause is understood.

No random fixes, no bundled speculative changes.

## Key Risks

### Money serialization

Risk: JSON numbers or direct `bigint` serialization create precision/runtime bugs.

Control: all `*Minor` API fields are decimal strings.

### Duplicate rebuys

Risk: double tap creates two rebuy rows.

Control: required idempotency keys plus pending UI state.

### Product boundary

Risk: manual transfer instructions look like payment processing.

Control: copy, icons, and CTAs must stay accounting-oriented.

### Privacy

Risk: global leaderboard exposes sensitive results too broadly.

Control: keep global leaderboard in MVP, but preserve explicit scope and privacy-ready API.

### Scope drift

Risk: adding clubs, subscriptions, wallets, or advanced analytics before MVP.

Control: reject out-of-scope additions until Sprint 7 acceptance passes.
