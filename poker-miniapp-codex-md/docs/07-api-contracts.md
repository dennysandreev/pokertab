# 07. API Contracts

## API style

Use REST for MVP.

Base path:

```text
/api
```

All authenticated routes require Telegram Mini App init data validation or a session token issued after validation.

## Money serialization

Database stores money in integer minor units (`BigInt` in Prisma/PostgreSQL).

API must serialize every `*Minor` money field as a decimal string, not as a JSON number.
This avoids precision loss and avoids trying to serialize JavaScript `bigint` values directly.

Examples:

```json
{
  "rebuyAmountMinor": "100000",
  "netResultMinor": "-450000",
  "differenceMinor": "0"
}
```

Frontend must parse these fields with a shared money utility and never use floating point
for calculations.

## Auth

### POST /auth/telegram

Validates Telegram initData and creates/updates user.

Request:

```json
{
  "initData": "telegram_init_data_string"
}
```

Response:

```json
{
  "accessToken": "jwt_or_session_token",
  "user": {
    "id": "user_1",
    "telegramId": "123456",
    "username": "denis",
    "firstName": "Denis"
  }
}
```

## Rooms

### GET /rooms

Returns user's rooms.

Response:

```json
{
  "active": [
    {
      "id": "room_1",
      "title": "Покер у Дениса",
      "status": "RUNNING",
      "currency": "RUB",
      "rebuyAmountMinor": "100000",
      "playersCount": 6,
      "totalPotMinor": "1800000",
      "myBuyinsMinor": "300000"
    }
  ],
  "recent": [
    {
      "id": "room_2",
      "title": "Friday Poker",
      "status": "CLOSED",
      "closedAt": "2026-05-11T20:30:00.000Z",
      "myNetResultMinor": "450000"
    }
  ]
}
```

### POST /rooms

Creates room.

Request:

```json
{
  "title": "Покер у Дениса",
  "currency": "RUB",
  "rebuyAmountMinor": "100000",
  "startingStack": 10000,
  "gameType": "SIMPLE_TRACKING",
  "rebuyPermission": "PLAYER_SELF"
}
```

Response:

```json
{
  "room": {
    "id": "room_1",
    "title": "Покер у Дениса",
    "status": "WAITING",
    "inviteCode": "abc123",
    "inviteUrl": "https://t.me/poker_bot/app?startapp=room_abc123"
  }
}
```

### GET /rooms/:roomId

Returns room details.

Response:

```json
{
  "room": {
    "id": "room_1",
    "title": "Покер у Дениса",
    "status": "RUNNING",
    "currency": "RUB",
    "rebuyAmountMinor": "100000",
    "startingStack": 10000,
    "totalPotMinor": "2400000",
    "myRole": "OWNER"
  },
  "players": [
    {
      "id": "rp_1",
      "userId": "user_1",
      "displayName": "Denis",
      "role": "OWNER",
      "rebuyCount": 3,
      "totalBuyinMinor": "300000",
      "finalAmountMinor": null,
      "netResultMinor": null
    }
  ]
}
```

### POST /rooms/join

Join room by invite code.

Request:

```json
{
  "inviteCode": "abc123"
}
```

Response:

```json
{
  "roomId": "room_1",
  "status": "WAITING",
  "playerId": "rp_2"
}
```

### POST /rooms/:roomId/start

Admin starts game.

Response:

```json
{
  "roomId": "room_1",
  "status": "RUNNING",
  "startedAt": "2026-05-11T20:00:00.000Z"
}
```

## Rebuys

### POST /rooms/:roomId/rebuys

Create rebuy.

Request for self:

```json
{
  "roomPlayerId": "rp_self",
  "idempotencyKey": "uuid"
}
```

Request by admin for another player:

```json
{
  "roomPlayerId": "rp_2",
  "idempotencyKey": "uuid"
}
```

Response:

```json
{
  "rebuy": {
    "id": "rebuy_1",
    "roomId": "room_1",
    "roomPlayerId": "rp_2",
    "amountMinor": "100000",
    "source": "ADMIN_FOR_PLAYER",
    "status": "ACTIVE",
    "createdAt": "2026-05-11T21:14:00.000Z"
  },
  "playerTotals": {
    "rebuyCount": 3,
    "totalBuyinMinor": "300000"
  },
  "roomTotals": {
    "totalPotMinor": "2400000"
  }
}
```

### POST /rooms/:roomId/rebuys/:rebuyId/cancel

Admin cancels rebuy.

Request:

```json
{
  "reason": "Mistake"
}
```

Response:

```json
{
  "rebuyId": "rebuy_1",
  "status": "CANCELLED"
}
```

### GET /rooms/:roomId/rebuys

Returns rebuy history.

Query:
- limit
- cursor

Response:

```json
{
  "items": [
    {
      "id": "rebuy_1",
      "playerName": "Ilya",
      "createdByName": "Ilya",
      "amountMinor": "100000",
      "source": "PLAYER_SELF",
      "status": "ACTIVE",
      "createdAt": "2026-05-11T21:14:00.000Z"
    }
  ],
  "nextCursor": null
}
```

## Settlement

### POST /rooms/:roomId/settlement/preview

Calculates settlement preview.

Request:

```json
{
  "finalAmounts": [
    {
      "roomPlayerId": "rp_1",
      "finalAmountMinor": "750000"
    },
    {
      "roomPlayerId": "rp_2",
      "finalAmountMinor": "400000"
    }
  ]
}
```

Response:

```json
{
  "totalBuyinsMinor": "2400000",
  "totalFinalAmountMinor": "2400000",
  "differenceMinor": "0",
  "players": [
    {
      "roomPlayerId": "rp_1",
      "displayName": "Denis",
      "totalBuyinMinor": "300000",
      "finalAmountMinor": "750000",
      "netResultMinor": "450000"
    }
  ],
  "transfers": [
    {
      "fromRoomPlayerId": "rp_4",
      "fromName": "Nikita",
      "toRoomPlayerId": "rp_1",
      "toName": "Denis",
      "amountMinor": "300000"
    }
  ]
}
```

### POST /rooms/:roomId/settlement/close

Closes game with settlement.

Request:

```json
{
  "finalAmounts": [
    {
      "roomPlayerId": "rp_1",
      "finalAmountMinor": "750000"
    }
  ]
}
```

Response:

```json
{
  "roomId": "room_1",
  "status": "CLOSED",
  "settlementId": "settlement_1"
}
```

## Leaderboard

### GET /leaderboard

Query:
- scope: `all` or `played-with-me`
- period: `all-time`, `month`, `last-10`
- limit
- cursor

Response:

```json
{
  "items": [
    {
      "rank": 1,
      "userId": "user_1",
      "displayName": "Denis",
      "totalProfitMinor": "4550000",
      "gamesCount": 23,
      "roiBps": 1800,
      "winRateBps": 6100,
      "avgProfitMinor": "197800",
      "pokerScore": 84
    }
  ],
  "nextCursor": null
}
```

### GET /players/:userId/profile

Response:

```json
{
  "user": {
    "id": "user_1",
    "displayName": "Denis",
    "username": "denis"
  },
  "stats": {
    "gamesCount": 23,
    "totalBuyinsMinor": "25000000",
    "totalProfitMinor": "4550000",
    "roiBps": 1800,
    "winRateBps": 6100,
    "avgProfitMinor": "197800",
    "pokerScore": 84,
    "bestGameMinor": "850000",
    "worstGameMinor": "-400000"
  },
  "recentGames": []
}
```

## Error format

Use consistent errors:

```json
{
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "Room not found",
    "details": {}
  }
}
```

## Important error codes

- UNAUTHORIZED
- FORBIDDEN
- ROOM_NOT_FOUND
- ROOM_CLOSED
- ROOM_NOT_RUNNING
- INVALID_REBUY_AMOUNT
- SETTLEMENT_NOT_BALANCED
- DUPLICATE_REQUEST
- PLAYER_NOT_IN_ROOM
- ADMIN_REQUIRED
