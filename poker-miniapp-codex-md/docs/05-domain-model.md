# 05. Domain Model

## Core entities

### User

Telegram user inside the app.

Fields:
- id
- telegramId
- username
- firstName
- lastName
- avatarUrl
- createdAt
- updatedAt

### Room

Poker table / game room.

Fields:
- id
- ownerUserId
- title
- currency
- rebuyAmountMinor
- startingStack
- gameType
- rebuyPermission
- status
- inviteCode
- createdAt
- startedAt
- settlementStartedAt
- closedAt
- cancelledAt

### RoomPlayer

User's participation in a room.

Fields:
- id
- roomId
- userId
- displayName
- role
- status
- joinedAt
- removedAt
- finalAmountMinor
- netResultMinor

Derived:
- activeRebuyCount
- totalBuyinMinor

### RebuyEvent

Immutable-ish event for rebuy tracking.

Fields:
- id
- roomId
- roomPlayerId
- amountMinor
- createdByUserId
- source
- status
- createdAt
- cancelledAt
- cancelledByUserId
- cancellationReason

Source:
- PLAYER_SELF
- ADMIN_FOR_PLAYER
- SYSTEM_IMPORT

Status:
- ACTIVE
- CANCELLED

### Settlement

Final calculation snapshot for a room.

Fields:
- id
- roomId
- status
- totalBuyinsMinor
- totalFinalAmountMinor
- differenceMinor
- calculatedAt
- closedByUserId

Status:
- DRAFT
- VALID
- CLOSED

### SettlementTransfer

Optimized transfer row.

Fields:
- id
- settlementId
- fromRoomPlayerId
- toRoomPlayerId
- amountMinor
- status

Status:
- PENDING
- MARKED_PAID
- CANCELLED

For MVP, payment statuses are optional. Do not process payments.

### PlayerStats

Aggregated stats.

Fields:
- userId
- gamesCount
- totalBuyinsMinor
- totalProfitMinor
- avgProfitMinor
- roiBps
- winRateBps
- stabilityScoreBps
- pokerScore
- updatedAt

Bps = basis points. 10000 bps = 100%.

## Enums

### RoomStatus

```ts
DRAFT
WAITING
RUNNING
SETTLEMENT
CLOSED
CANCELLED
```

### RoomPlayerRole

```ts
OWNER
ADMIN
PLAYER
```

### RoomPlayerStatus

```ts
ACTIVE
REMOVED
LEFT
```

### GameType

```ts
CASH
TOURNAMENT
SIMPLE_TRACKING
```

### RebuyPermission

```ts
PLAYER_SELF
ADMIN_APPROVAL
ADMIN_ONLY
```

MVP default:
```ts
PLAYER_SELF
```

### RebuyEventSource

```ts
PLAYER_SELF
ADMIN_FOR_PLAYER
SYSTEM_IMPORT
```

### RebuyEventStatus

```ts
ACTIVE
CANCELLED
```

## Money rules

Store money as integer minor units.

Examples:
- 1 000 ₽ = `100000` kopecks
- 10 USD = `1000` cents

Never store money as floating point.

## Derived calculations

For each player:

```text
totalBuyinMinor = sum(active rebuy events amountMinor)
netResultMinor = finalAmountMinor - totalBuyinMinor
```

For room:

```text
totalBuyinsMinor = sum(player.totalBuyinMinor)
totalFinalAmountMinor = sum(player.finalAmountMinor)
differenceMinor = totalFinalAmountMinor - totalBuyinsMinor
```

Settlement can close only if:

```text
differenceMinor === 0
```
