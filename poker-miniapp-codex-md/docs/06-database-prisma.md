# 06. Database & Prisma Draft

## Notes

This is a domain-level Prisma draft. Codex should convert it into actual `schema.prisma` and migrations.

Use PostgreSQL.

Money fields must be `BigInt` or integer type capable of storing minor units safely.

API must serialize money fields as decimal strings. Prisma/PostgreSQL may store them as
`BigInt`, but JSON contracts must not expose them as unsafe numbers.

Rebuy creation must be idempotent. The MVP should store idempotency keys server-side so
duplicate taps cannot create duplicate rebuy events.

## Prisma draft

```prisma
model User {
  id          String   @id @default(cuid())
  telegramId String   @unique
  username    String?
  firstName   String?
  lastName    String?
  avatarUrl   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  ownedRooms  Room[]       @relation("RoomOwner")
  roomPlayers RoomPlayer[]
  rebuyEvents RebuyEvent[] @relation("RebuyCreatedBy")
  idempotencyKeys IdempotencyKey[]
  closedSettlements Settlement[] @relation("SettlementClosedBy")
}

model Room {
  id                 String   @id @default(cuid())
  ownerUserId        String
  title              String
  currency           String
  rebuyAmountMinor   BigInt
  startingStack      Int?
  gameType           GameType @default(SIMPLE_TRACKING)
  rebuyPermission    RebuyPermission @default(PLAYER_SELF)
  status             RoomStatus @default(WAITING)
  inviteCode         String   @unique
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  startedAt          DateTime?
  settlementStartedAt DateTime?
  closedAt           DateTime?
  cancelledAt        DateTime?

  owner       User @relation("RoomOwner", fields: [ownerUserId], references: [id])
  players     RoomPlayer[]
  rebuys      RebuyEvent[]
  settlements Settlement[]

  @@index([ownerUserId])
  @@index([status])
  @@index([inviteCode])
}

model RoomPlayer {
  id               String @id @default(cuid())
  roomId           String
  userId           String
  displayName      String?
  role             RoomPlayerRole @default(PLAYER)
  status           RoomPlayerStatus @default(ACTIVE)
  joinedAt         DateTime @default(now())
  removedAt        DateTime?
  finalAmountMinor BigInt?
  netResultMinor   BigInt?

  room       Room @relation(fields: [roomId], references: [id])
  user       User @relation(fields: [userId], references: [id])
  rebuys     RebuyEvent[]
  transfersFrom SettlementTransfer[] @relation("TransferFrom")
  transfersTo   SettlementTransfer[] @relation("TransferTo")

  @@unique([roomId, userId])
  @@index([roomId])
  @@index([userId])
}

model RebuyEvent {
  id                 String @id @default(cuid())
  roomId             String
  roomPlayerId       String
  amountMinor        BigInt
  createdByUserId    String
  source             RebuyEventSource
  status             RebuyEventStatus @default(ACTIVE)
  createdAt          DateTime @default(now())
  idempotencyKey     String?
  cancelledAt        DateTime?
  cancelledByUserId  String?
  cancellationReason String?

  room          Room @relation(fields: [roomId], references: [id])
  roomPlayer    RoomPlayer @relation(fields: [roomPlayerId], references: [id])
  createdByUser User @relation("RebuyCreatedBy", fields: [createdByUserId], references: [id])

  @@index([roomId])
  @@index([roomPlayerId])
  @@index([status])
  @@index([createdAt])
  @@unique([createdByUserId, idempotencyKey])
}

model IdempotencyKey {
  id               String @id @default(cuid())
  key              String
  userId           String
  action           String
  requestHash      String?
  responseSnapshot Json?
  createdAt        DateTime @default(now())
  expiresAt        DateTime?

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, action, key])
  @@index([userId])
  @@index([createdAt])
}

model Settlement {
  id                    String @id @default(cuid())
  roomId                String
  status                SettlementStatus @default(DRAFT)
  totalBuyinsMinor      BigInt
  totalFinalAmountMinor BigInt
  differenceMinor       BigInt
  calculatedAt          DateTime @default(now())
  closedByUserId        String?

  room         Room @relation(fields: [roomId], references: [id])
  closedByUser User? @relation("SettlementClosedBy", fields: [closedByUserId], references: [id])
  transfers    SettlementTransfer[]

  @@index([roomId])
}

model SettlementTransfer {
  id               String @id @default(cuid())
  settlementId     String
  fromRoomPlayerId String
  toRoomPlayerId   String
  amountMinor      BigInt
  status           SettlementTransferStatus @default(PENDING)

  settlement Settlement @relation(fields: [settlementId], references: [id])
  fromPlayer RoomPlayer @relation("TransferFrom", fields: [fromRoomPlayerId], references: [id])
  toPlayer   RoomPlayer @relation("TransferTo", fields: [toRoomPlayerId], references: [id])

  @@index([settlementId])
  @@index([fromRoomPlayerId])
  @@index([toRoomPlayerId])
}

model PlayerStats {
  userId              String @id
  gamesCount          Int @default(0)
  totalBuyinsMinor    BigInt @default(0)
  totalProfitMinor    BigInt @default(0)
  avgProfitMinor      BigInt @default(0)
  roiBps              Int @default(0)
  winRateBps          Int @default(0)
  stabilityScoreBps   Int @default(0)
  pokerScore          Int @default(0)
  updatedAt           DateTime @updatedAt
}

enum RoomStatus {
  DRAFT
  WAITING
  RUNNING
  SETTLEMENT
  CLOSED
  CANCELLED
}

enum RoomPlayerRole {
  OWNER
  ADMIN
  PLAYER
}

enum RoomPlayerStatus {
  ACTIVE
  REMOVED
  LEFT
}

enum GameType {
  CASH
  TOURNAMENT
  SIMPLE_TRACKING
}

enum RebuyPermission {
  PLAYER_SELF
  ADMIN_APPROVAL
  ADMIN_ONLY
}

enum RebuyEventSource {
  PLAYER_SELF
  ADMIN_FOR_PLAYER
  SYSTEM_IMPORT
}

enum RebuyEventStatus {
  ACTIVE
  CANCELLED
}

enum SettlementStatus {
  DRAFT
  VALID
  CLOSED
}

enum SettlementTransferStatus {
  PENDING
  MARKED_PAID
  CANCELLED
}
```

## Indexing notes

Need indexes for:
- active rooms by owner;
- rooms by inviteCode;
- players by room;
- rebuys by room and createdAt;
- leaderboard stats.

## Migration notes

Start with:
1. users;
2. rooms;
3. room_players;
4. rebuy_events;
5. idempotency_keys;
6. settlements;
7. settlement_transfers;
8. player_stats.
