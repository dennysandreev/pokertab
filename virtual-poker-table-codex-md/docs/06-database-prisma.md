# 06. Prisma Draft — Virtual Table

## Notes

This draft should be converted into actual `schema.prisma`.

Use integer types for chips. Use BigInt if chip counts can become large.

Private cards must be protected by API layer.

## Prisma draft

```prisma
model VirtualTable {
  id                      String @id @default(cuid())
  ownerUserId             String
  title                   String
  maxSeats                Int @default(9)
  startingStackChips      BigInt
  chipValueMinor          BigInt?
  chipValueCurrency       String?
  smallBlindChips         BigInt
  bigBlindChips           BigInt
  pendingSmallBlindChips  BigInt?
  pendingBigBlindChips    BigInt?
  turnDurationSeconds     Int
  reminderDelaySeconds    Int
  timeoutAutoActionRule   TimeoutAutoActionRule @default(CHECK_OR_FOLD)
  status                  VirtualTableStatus @default(WAITING_FOR_PLAYERS)
  inviteCode              String @unique
  currentHandId           String?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  startedAt               DateTime?
  pausedAt                DateTime?
  finishedAt              DateTime?

  seats   VirtualSeat[]
  hands   VirtualHand[]
  actions VirtualAction[]
  timers  TurnTimer[]

  @@index([ownerUserId])
  @@index([status])
  @@index([inviteCode])
}

model VirtualSeat {
  id                                      String @id @default(cuid())
  tableId                                 String
  userId                                  String
  seatNumber                              Int
  displayName                             String?
  role                                    VirtualSeatRole @default(PLAYER)
  status                                  VirtualSeatStatus @default(ACTIVE)
  stackChips                              BigInt
  joinedAt                                DateTime @default(now())
  leftAt                                  DateTime?
  sitOutRequestedAt                       DateTime?
  sitOutAutoCheckEnabled                  Boolean @default(false)
  sitOutAutoFoldEnabled                   Boolean @default(false)
  hasPassedSmallBlindSinceSitOutRequest   Boolean @default(false)
  hasPassedBigBlindSinceSitOutRequest     Boolean @default(false)
  returnRequestedAt                       DateTime?

  table VirtualTable @relation(fields: [tableId], references: [id])
  handPlayers VirtualHandPlayer[]
  actions VirtualAction[]
  timers TurnTimer[]

  @@unique([tableId, userId])
  @@unique([tableId, seatNumber])
  @@index([tableId])
  @@index([userId])
  @@index([status])
}

model VirtualHand {
  id                 String @id @default(cuid())
  tableId            String
  handNumber         Int
  status             VirtualHandStatus @default(CREATED)
  dealerSeatId       String
  smallBlindSeatId   String
  bigBlindSeatId     String
  smallBlindChips    BigInt
  bigBlindChips      BigInt
  currentStreet      Street @default(PRE_FLOP)
  currentActorSeatId String?
  currentBetChips    BigInt @default(0)
  minRaiseChips      BigInt @default(0)
  potTotalChips      BigInt @default(0)
  deckSeedHash       String?
  startedAt          DateTime @default(now())
  completedAt        DateTime?

  table VirtualTable @relation(fields: [tableId], references: [id])
  players VirtualHandPlayer[]
  communityCards CommunityCard[]
  actions VirtualAction[]
  pots VirtualPot[]
  timers TurnTimer[]

  @@unique([tableId, handNumber])
  @@index([tableId])
  @@index([status])
}

model VirtualHandPlayer {
  id                    String @id @default(cuid())
  handId                String
  seatId                String
  status                HandPlayerStatus @default(ACTIVE)
  startingStackChips    BigInt
  currentStackChips     BigInt
  committedTotalChips   BigInt @default(0)
  committedStreetChips  BigInt @default(0)
  privateCard1          String?
  privateCard2          String?
  hasActedThisStreet    Boolean @default(false)
  isEligibleForShowdown Boolean @default(true)

  hand VirtualHand @relation(fields: [handId], references: [id])
  seat VirtualSeat @relation(fields: [seatId], references: [id])

  @@unique([handId, seatId])
  @@index([handId])
  @@index([seatId])
  @@index([status])
}

model CommunityCard {
  id       String @id @default(cuid())
  handId   String
  street   Street
  card     String
  position Int

  hand VirtualHand @relation(fields: [handId], references: [id])

  @@unique([handId, position])
  @@index([handId])
}

model VirtualAction {
  id          String @id @default(cuid())
  tableId     String
  handId      String?
  seatId      String?
  actorType   ActionActorType
  actionType  ActionType
  amountChips BigInt?
  metadataJson Json?
  createdAt   DateTime @default(now())

  table VirtualTable @relation(fields: [tableId], references: [id])
  hand  VirtualHand? @relation(fields: [handId], references: [id])
  seat  VirtualSeat? @relation(fields: [seatId], references: [id])

  @@index([tableId])
  @@index([handId])
  @@index([seatId])
  @@index([createdAt])
}

model VirtualPot {
  id                  String @id @default(cuid())
  handId              String
  potType             PotType
  amountChips         BigInt
  capChips            BigInt?
  eligibleSeatIdsJson Json
  awardedAt           DateTime?

  hand VirtualHand @relation(fields: [handId], references: [id])
  awards VirtualPotAward[]

  @@index([handId])
}

model VirtualPotAward {
  id           String @id @default(cuid())
  potId        String
  winnerSeatId String
  amountChips  BigInt
  handRankJson Json?

  pot VirtualPot @relation(fields: [potId], references: [id])

  @@index([potId])
  @@index([winnerSeatId])
}

model TurnTimer {
  id             String @id @default(cuid())
  tableId        String
  handId         String
  seatId         String
  status         TurnTimerStatus @default(ACTIVE)
  startedAt      DateTime
  reminderDueAt  DateTime
  expiresAt      DateTime
  remindedAt     DateTime?
  resolvedAt     DateTime?
  resolutionType TurnTimerResolution?

  table VirtualTable @relation(fields: [tableId], references: [id])
  hand VirtualHand @relation(fields: [handId], references: [id])
  seat VirtualSeat @relation(fields: [seatId], references: [id])

  @@index([status])
  @@index([reminderDueAt])
  @@index([expiresAt])
}

model OnlinePlayerStats {
  userId              String @id
  handsPlayed         Int @default(0)
  handsWon            Int @default(0)
  totalChipsWon       BigInt @default(0)
  totalChipsLost      BigInt @default(0)
  netChips            BigInt @default(0)
  netEstimatedMinor   BigInt @default(0)
  bigBlindsWon        BigInt @default(0)
  bbPer100Bps         Int @default(0)
  winRateBps          Int @default(0)
  avgChipsPerHand     BigInt @default(0)
  onlinePokerScore    Int @default(0)
  updatedAt           DateTime @updatedAt
}
```

## Enums draft

```prisma
enum VirtualTableStatus { WAITING_FOR_PLAYERS ACTIVE PAUSED FINISHED CANCELLED }
enum VirtualSeatRole { OWNER ADMIN PLAYER }
enum VirtualSeatStatus { ACTIVE WAITING_FOR_TURN ACTING FOLDED ALL_IN SIT_OUT_REQUESTED SITTING_OUT RETURN_REQUESTED LEFT NO_CHIPS }
enum VirtualHandStatus { CREATED DEALING IN_PROGRESS SHOWDOWN COMPLETED CANCELLED }
enum HandPlayerStatus { ACTIVE FOLDED ALL_IN SITTING_OUT }
enum Street { PRE_FLOP FLOP TURN RIVER SHOWDOWN }
enum ActionActorType { PLAYER ADMIN SYSTEM }
enum ActionType { POST_SMALL_BLIND POST_BIG_BLIND FOLD CHECK CALL BET RAISE ALL_IN AUTO_CHECK AUTO_FOLD DEAL_HOLE_CARDS DEAL_FLOP DEAL_TURN DEAL_RIVER SHOWDOWN POT_AWARDED SIT_OUT_REQUESTED SITTING_OUT RETURN_REQUESTED TABLE_PAUSED TABLE_RESUMED BLINDS_RAISED HAND_STARTED HAND_COMPLETED }
enum PotType { MAIN SIDE }
enum TimeoutAutoActionRule { CHECK_OR_FOLD FOLD_ONLY }
enum TurnTimerStatus { ACTIVE REMINDED RESOLVED CANCELLED }
enum TurnTimerResolution { PLAYER_ACTION AUTO_CHECK AUTO_FOLD TABLE_PAUSED HAND_COMPLETED }
```
