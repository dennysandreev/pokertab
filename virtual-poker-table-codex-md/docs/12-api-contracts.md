# 12. API Contracts — Virtual Table

## Base path

```text
/api/virtual
```

All routes require authenticated Telegram user/session.

## Route map

### Table lifecycle

- `POST /tables`
- `POST /tables/join`
- `GET /tables`
- `GET /tables/:tableId`
- `POST /tables/:tableId/start`
- `POST /tables/:tableId/hands/next`
- `POST /tables/:tableId/pause`
- `POST /tables/:tableId/resume`
- `POST /tables/:tableId/finish`
- `POST /tables/:tableId/cancel`
- `POST /tables/:tableId/raise-blinds`

### Player actions

- `POST /tables/:tableId/actions`
- `POST /tables/:tableId/sit-out/request`
- `POST /tables/:tableId/return`

### History and stats

- `GET /tables/:tableId/hands`
- `GET /tables/:tableId/hands/:handId/history`
- `GET /leaderboard`
- `GET /stats/me`

## Shared enums

### Table statuses

- `WAITING_FOR_PLAYERS`
- `ACTIVE`
- `PAUSED`
- `FINISHED`
- `CANCELLED`

### Seat roles

- `OWNER`
- `ADMIN`
- `PLAYER`

### Seat statuses

- `ACTIVE`
- `WAITING_FOR_TURN`
- `ACTING`
- `FOLDED`
- `ALL_IN`
- `SIT_OUT_REQUESTED`
- `SITTING_OUT`
- `RETURN_REQUESTED`
- `LEFT`
- `NO_CHIPS`

### Hand statuses

- `CREATED`
- `DEALING`
- `IN_PROGRESS`
- `SHOWDOWN`
- `COMPLETED`
- `CANCELLED`

### Streets

- `PRE_FLOP`
- `FLOP`
- `TURN`
- `RIVER`
- `SHOWDOWN`

### Timeout auto-action rules

- `CHECK_OR_FOLD`
- `FOLD_ONLY`

### Action types

- `FOLD`
- `CHECK`
- `CALL`
- `BET`
- `RAISE`
- `ALL_IN`

## Tables

### POST /tables

Create virtual table.

Request:

```json
{
  "title": "Poker Weekend",
  "maxSeats": 9,
  "startingStackChips": "10000",
  "chipValueMinor": "10",
  "chipValueCurrency": "RUB",
  "smallBlindChips": "50",
  "bigBlindChips": "100",
  "turnDurationSeconds": 300,
  "reminderDelaySeconds": 120,
  "timeoutAutoActionRule": "CHECK_OR_FOLD"
}
```

Notes:

- `maxSeats`: from `2` to `9`.
- `turnDurationSeconds`: from `10` to `300`.
- `reminderDelaySeconds`: at least `5`, and strictly less than `turnDurationSeconds`.
- chip values are integer strings in chips/minor units.

Response:

```json
{
  "table": {
    "id": "vt_1",
    "title": "Poker Weekend",
    "status": "WAITING_FOR_PLAYERS",
    "inviteCode": "ABC12345",
    "inviteUrl": "https://pokertab.ru/join/virtual/ABC12345",
    "startingStackChips": "10000",
    "smallBlindChips": "50",
    "bigBlindChips": "100",
    "chipValueMinor": "10",
    "chipValueCurrency": "RUB"
  }
}
```

`inviteUrl` is built from `WEB_APP_URL` and the dedicated `/join/virtual/:inviteCode`
Mini App route. Telegram bot deep links can still use the same `inviteCode` with
`startapp=virtual_table_<inviteCode>`.

### POST /tables/join

Request:

```json
{ "inviteCode": "ABC12345" }
```

Response:

```json
{
  "tableId": "vt_1",
  "seatId": "seat_2",
  "status": "WAITING_FOR_PLAYERS"
}
```

### GET /tables

Returns virtual tables visible to the current user.

Response:

```json
{
  "items": [
    {
      "id": "vt_1",
      "title": "Poker Weekend",
      "status": "ACTIVE",
      "inviteCode": "ABC12345",
      "maxSeats": 9,
      "currentHandId": "hand_24",
      "startingStackChips": "10000",
      "chipValueMinor": "10",
      "chipValueCurrency": "RUB",
      "smallBlindChips": "50",
      "bigBlindChips": "100",
      "turnDurationSeconds": 300,
      "reminderDelaySeconds": 120,
      "timeoutAutoActionRule": "CHECK_OR_FOLD",
      "potTotalChips": "1200",
      "createdAt": "2026-05-13T09:55:00.000Z",
      "startedAt": "2026-05-13T10:00:00.000Z",
      "pausedAt": null,
      "finishedAt": null,
      "seatsCount": 4,
      "activeSeatsCount": 3,
      "mySeatId": "seat_2",
      "mySeatStatus": "ACTING",
      "currentActorSeatId": "seat_2",
      "currentStreet": "FLOP",
      "lastHandNumber": 24
    }
  ]
}
```

### GET /tables/:tableId

Returns current table state for the current user.

Privacy rules:

- `seats` are shared table state.
- `hand.myPrivateCards` contains only the viewer's own cards.
- no endpoint in `/api/virtual/tables/:tableId` exposes other players' hole cards.

Response:

```json
{
  "table": {
    "id": "vt_1",
    "title": "Poker Weekend",
    "status": "ACTIVE",
    "maxSeats": 9,
    "inviteCode": "ABC12345",
    "startingStackChips": "10000",
    "chipValueMinor": "10",
    "chipValueCurrency": "RUB",
    "smallBlindChips": "50",
    "bigBlindChips": "100",
    "pendingSmallBlindChips": null,
    "pendingBigBlindChips": null,
    "turnDurationSeconds": 300,
    "reminderDelaySeconds": 120,
    "timeoutAutoActionRule": "CHECK_OR_FOLD",
    "potTotalChips": "1200",
    "currentHandId": "hand_24",
    "createdAt": "2026-05-13T09:55:00.000Z",
    "startedAt": "2026-05-13T10:00:00.000Z",
    "pausedAt": null,
    "finishedAt": null
  },
  "seats": [
    {
      "id": "seat_1",
      "userId": "user_1",
      "displayName": "Denis",
      "seatNumber": 1,
      "role": "OWNER",
      "stackChips": "10500",
      "status": "ACTIVE",
      "isDealer": true,
      "isSmallBlind": false,
      "isBigBlind": false
    }
  ],
  "hand": {
    "id": "hand_24",
    "handNumber": 24,
    "status": "IN_PROGRESS",
    "street": "FLOP",
    "board": ["AS", "7H", "2C"],
    "currentActorSeatId": "seat_2",
    "currentTimer": {
      "id": "timer_1",
      "seatId": "seat_2",
      "status": "ACTIVE",
      "startedAt": "2026-05-13T10:00:00.000Z",
      "reminderDueAt": "2026-05-13T10:02:00.000Z",
      "expiresAt": "2026-05-13T10:05:00.000Z",
      "remindedAt": null
    },
    "currentBetChips": "300",
    "callAmountChips": "300",
    "myPrivateCards": ["AD", "KC"],
    "myLegalActions": [
      { "type": "FOLD" },
      { "type": "CALL", "amountChips": "300" },
      { "type": "RAISE", "minAmountChips": "600" },
      { "type": "ALL_IN", "amountChips": "9700" }
    ]
  }
}
```

`hand.currentTimer`:

- is present only when the table has a current hand and there is an unresolved turn timer;
- has `status: "ACTIVE"` before reminder and `status: "REMINDED"` after reminder is sent;
- becomes `null` after action resolution, on pause, on finish/cancel, or when no active timer exists.

### POST /tables/:tableId/start

Admin starts table.

Response:

```json
{
  "tableId": "vt_1",
  "status": "ACTIVE",
  "startedAt": "2026-05-13T10:00:00.000Z",
  "currentHandId": "hand_24"
}
```

### POST /tables/:tableId/hands/next

Admin starts the next hand when the table is already active and ready for a new hand.

Response shape is the same as `POST /tables/:tableId/start`.

### POST /tables/:tableId/pause

Admin pauses table.

Response:

```json
{
  "tableId": "vt_1",
  "status": "PAUSED",
  "pausedAt": "2026-05-13T10:04:00.000Z"
}
```

### POST /tables/:tableId/resume

Admin resumes table.

Response:

```json
{
  "tableId": "vt_1",
  "status": "ACTIVE",
  "resumedAt": "2026-05-13T10:06:00.000Z"
}
```

### POST /tables/:tableId/finish

Admin finishes table.

Behavior:

- allowed from `WAITING_FOR_PLAYERS`, `ACTIVE`, or `PAUSED`;
- idempotent when the table is already `FINISHED`;
- rejects if the table is already `CANCELLED`;
- cancels active/reminded turn timers;
- if the current hand is still open (`CREATED`, `DEALING`, `IN_PROGRESS`, `SHOWDOWN`), marks that hand as `CANCELLED`.

Response:

```json
{
  "tableId": "vt_1",
  "status": "FINISHED",
  "finishedAt": "2026-05-13T10:30:00.000Z",
  "currentHandId": "hand_24"
}
```

### POST /tables/:tableId/cancel

Admin cancels table before gameplay starts.

Behavior:

- allowed only while table status is `WAITING_FOR_PLAYERS`;
- requires `currentHandId === null`;
- idempotent when the table is already `CANCELLED`;
- rejects if the table is already `FINISHED`;
- rejects once a game has started; after that the table must be finished, not cancelled.

Response:

```json
{
  "tableId": "vt_1",
  "status": "CANCELLED",
  "finishedAt": "2026-05-13T09:58:00.000Z",
  "currentHandId": null
}
```

### POST /tables/:tableId/raise-blinds

Admin schedules blind raise for the next hand.

Request:

```json
{
  "smallBlindChips": "100",
  "bigBlindChips": "200"
}
```

Response:

```json
{
  "pendingSmallBlindChips": "100",
  "pendingBigBlindChips": "200",
  "applies": "NEXT_HAND"
}
```

## Actions

### POST /tables/:tableId/actions

Submit player action for the current hand.

Request:

```json
{
  "handId": "hand_24",
  "actionType": "CALL",
  "amountChips": "300",
  "idempotencyKey": "3b1d4fb2-5cd2-41a3-9ef6-49f05db05f4a"
}
```

Rules:

- `idempotencyKey` is required for every request.
- repeated request with the same `tableId + seatId + idempotencyKey` restores the original response instead of creating a duplicate action.
- `amountChips` is optional in the payload, but mandatory for amount-based actions when required by game rules.
- only the current actor can act.
- table must be `ACTIVE`.

Response:

```json
{
  "tableId": "vt_1",
  "handId": "hand_24",
  "actionType": "CALL",
  "amountChips": "300",
  "handStatus": "IN_PROGRESS",
  "actedAt": "2026-05-13T10:01:30.000Z",
  "nextActorSeatId": "seat_3"
}
```

Legal action variants returned by `GET /tables/:tableId` in `hand.myLegalActions`:

- `{ "type": "FOLD" }`
- `{ "type": "CHECK" }`
- `{ "type": "CALL", "amountChips": "300" }`
- `{ "type": "BET", "minAmountChips": "200", "maxAmountChips": "9700" }`
- `{ "type": "RAISE", "minAmountChips": "600", "maxAmountChips": "9700" }`
- `{ "type": "ALL_IN", "amountChips": "9700" }`

## Sit-out

### POST /tables/:tableId/sit-out/request

Request:

```json
{
  "autoCheck": true,
  "autoFold": true
}
```

Response:

```json
{
  "seatStatus": "SIT_OUT_REQUESTED",
  "autoCheck": true,
  "autoFold": true
}
```

### POST /tables/:tableId/return

Request return from sitting out.

Response:

```json
{ "seatStatus": "RETURN_REQUESTED" }
```

The response may also return `{ "seatStatus": "ACTIVE" }` when the player is already active.

## Hand history

### GET /tables/:tableId/hands

Returns recent hands for a table. Current user must be a table participant.

Query:

```json
{
  "limit": "20",
  "cursor": null
}
```

Pagination contract:

- default `limit` is `20`;
- max `limit` is `100`;
- `cursor` is a positive integer string representing the last returned `handNumber`;
- next page returns hands with strictly smaller `handNumber`;
- response uses `take = limit + 1` internally to compute `nextCursor`.

Response:

```json
{
  "items": [
    {
      "id": "hand_24",
      "handNumber": 24,
      "status": "COMPLETED",
      "street": "SHOWDOWN",
      "potTotalChips": "1200",
      "board": ["AS", "7H", "2C", "QD", "9S"],
      "startedAt": "2026-05-13T10:00:00.000Z",
      "completedAt": "2026-05-13T10:08:00.000Z",
      "actionsCount": 12,
      "winners": [
        {
          "seatId": "seat_2",
          "displayName": "Denis",
          "amountChips": "1200"
        }
      ]
    }
  ],
  "nextCursor": "24"
}
```

This endpoint never returns private cards.

### GET /tables/:tableId/hands/:handId/history

Returns full action history for one hand.

Privacy rules for `players[].showdownCards`:

- cards are returned only when hand status is `COMPLETED`;
- folded players never reveal cards;
- non-folded players reveal exactly two cards if both cards are stored;
- for incomplete or cancelled hands, `showdownCards` is always `[]`.

Response:

```json
{
  "table": {
    "id": "vt_1",
    "title": "Poker Weekend",
    "status": "FINISHED",
    "inviteCode": "ABC12345",
    "maxSeats": 9,
    "startingStackChips": "10000",
    "chipValueMinor": "10",
    "chipValueCurrency": "RUB",
    "smallBlindChips": "50",
    "bigBlindChips": "100"
  },
  "hand": {
    "id": "hand_24",
    "handNumber": 24,
    "status": "COMPLETED",
    "street": "SHOWDOWN",
    "potTotalChips": "1200",
    "startedAt": "2026-05-13T10:00:00.000Z",
    "completedAt": "2026-05-13T10:08:00.000Z"
  },
  "board": ["AS", "7H", "2C", "QD", "9S"],
  "players": [
    {
      "seatId": "seat_1",
      "displayName": "Denis",
      "status": "ACTIVE",
      "committedTotalChips": "600",
      "stackAfterChips": "10500",
      "showdownCards": ["AD", "KC"]
    }
  ],
  "actions": [
    {
      "id": "action_1",
      "street": "PRE_FLOP",
      "actionType": "CALL",
      "amountChips": "100",
      "seatId": "seat_1",
      "displayName": "Denis",
      "actorType": "PLAYER",
      "createdAt": "2026-05-13T10:00:10.000Z"
    }
  ],
  "pots": [
    {
      "id": "pot_1",
      "amountChips": "1200",
      "eligibleSeatIds": ["seat_1", "seat_2"],
      "awards": [
        {
          "winnerSeatId": "seat_1",
          "displayName": "Denis",
          "amountChips": "1200",
          "handRankJson": {
            "category": "ONE_PAIR"
          }
        }
      ]
    }
  ]
}
```

## Leaderboard

### GET /leaderboard

Returns online leaderboard items ordered by:

- `onlinePokerScore` descending;
- `handsPlayed` descending;
- `netChips` descending;
- `userId` ascending.

Query:

```json
{
  "limit": "50",
  "cursor": null
}
```

Pagination contract:

- default `limit` is `50`;
- max `limit` is `100`;
- `cursor` is an opaque `base64url` JSON token built from the last item of the current page;
- client must pass back `nextCursor` unchanged.

Response:

```json
{
  "items": [
    {
      "rank": 1,
      "userId": "user_1",
      "displayName": "Denis",
      "username": "denis",
      "handsPlayed": 42,
      "handsWon": 11,
      "netChips": "1500",
      "netEstimatedMinor": "15000",
      "bigBlindsWon": "15",
      "bbPer100Bps": 3571,
      "winRateBps": 2619,
      "avgChipsPerHand": "35",
      "onlinePokerScore": 128
    }
  ],
  "nextCursor": "eyJvbmxpbmVQb2tlclNjb3JlIjoxMjgsImhhbmRzUGxheWVkIjo0MiwibmV0Q2hpcHMiOiIxNTAwIiwidXNlcklkIjoidXNlcl8xIn0"
}
```

If there are no more rows after the current page, `nextCursor` is `null`.

## Stats

### GET /stats/me

Returns current user's online virtual poker stats.

This endpoint has no query params and no pagination.

Response:

```json
{
  "stats": {
    "userId": "user_1",
    "displayName": "Denis",
    "username": "denis",
    "handsPlayed": 42,
    "handsWon": 11,
    "netChips": "1500",
    "netEstimatedMinor": "15000",
    "bigBlindsWon": "15",
    "bbPer100Bps": 3571,
    "winRateBps": 2619,
    "avgChipsPerHand": "35",
    "onlinePokerScore": 128
  }
}
```

If the user has no rows in `onlinePlayerStats`, the endpoint still returns the same object shape with zero values.

## Error codes

Current backend error code set:

- `VIRTUAL_INVALID_INPUT`
- `VIRTUAL_NOT_FOUND`
- `VIRTUAL_FORBIDDEN`
- `VIRTUAL_CONFLICT`
- `VIRTUAL_ACTION_NOT_ALLOWED`
