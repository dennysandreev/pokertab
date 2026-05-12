# 12. Backend Implementation

## Stack

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- JWT or session token after Telegram initData validation
- class-validator or zod for DTO validation

## Modules

```text
AuthModule
UsersModule
RoomsModule
RoomPlayersModule
RebuysModule
SettlementModule
LeaderboardModule
TelegramBotModule
StatsModule
```

## AuthModule

Responsibilities:
- validate Telegram initData;
- create/update user;
- issue app token;
- attach current user to request.

Endpoints:
- POST `/auth/telegram`

## RoomsModule

Responsibilities:
- create room;
- list rooms;
- get room details;
- join room;
- start room;
- transition room statuses.

Important:
- use transactions for status changes;
- check permissions on every mutation.

## RebuysModule

Responsibilities:
- create rebuy;
- cancel rebuy;
- list rebuy history.

Important:
- fixed amount from room.rebuyAmountMinor;
- no custom amount per rebuy in MVP;
- idempotency key support is required for MVP;
- prevent rebuy in non-running room.

## SettlementModule

Responsibilities:
- validate final amounts;
- calculate net results;
- calculate transfers;
- close room;
- create settlement snapshot.

Important:
- all settlement close operations must be transactionally consistent;
- update room status to CLOSED;
- update room players final/net values;
- create settlement;
- create settlement transfers;
- trigger stats recalculation.

## LeaderboardModule

Responsibilities:
- read aggregated stats;
- scope by all or played-with-me;
- filter by period;
- return ranked list.

MVP can calculate from closed room data directly if dataset is small.
Later use materialized stats.

## StatsModule

Responsibilities:
- recalculate stats after room close;
- calculate total profit, ROI, win rate, stability, poker score.

Approach for MVP:
- after settlement close, recalculate stats for all players in room.

## TelegramBotModule

Responsibilities:
- handle `/start`;
- provide Mini App button;
- send game notifications;
- share final result messages.

## Transactions

Use database transactions for:
- room creation + owner player creation;
- join room;
- start room;
- create rebuy + derived totals if stored;
- cancel rebuy;
- close settlement;
- stats recalculation.

## Authorization checks

Implement reusable guards/services:

```ts
assertRoomMember(userId, roomId)
assertRoomAdmin(userId, roomId)
assertRoomOwner(userId, roomId)
assertRoomStatus(roomId, expectedStatus)
```

## Idempotency

For rebuy creation, duplicate taps are dangerous.

Add a table and/or unique rebuy field:
- idempotencyKey;
- userId;
- action;
- request hash;
- response snapshot;
- createdAt.

Rules:
- frontend must generate an idempotency key before confirming a rebuy;
- frontend must disable the confirm button while the request is pending;
- backend must accept the idempotency key and return the same result for duplicate requests
  from the same user/action/key;
- duplicate requests with the same key but different payload should return `DUPLICATE_REQUEST`;
- idempotency records should expire later, but not before the immediate duplicate-tap window.

## Error handling

Use consistent domain errors:
- `RoomNotFoundError`
- `RoomClosedError`
- `AdminRequiredError`
- `PlayerNotInRoomError`
- `SettlementNotBalancedError`
- `DuplicateRequestError`

Map to HTTP:
- 400 validation;
- 401 auth;
- 403 permissions;
- 404 not found;
- 409 state conflict.

## Audit trail

Do not hard-delete:
- rooms;
- room players;
- rebuy events;
- settlement records.

Use statuses and timestamps.

## Performance notes

MVP does not need websockets.

Polling/refetch is acceptable:
- refetch room every 5-10 seconds while running;
- refetch on focus;
- refetch after mutation.

Later:
- add websocket/SSE for live updates.
