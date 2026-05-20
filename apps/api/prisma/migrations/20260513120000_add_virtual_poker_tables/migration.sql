-- CreateEnum
CREATE TYPE "VirtualTableStatus" AS ENUM ('WAITING_FOR_PLAYERS', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VirtualSeatRole" AS ENUM ('OWNER', 'ADMIN', 'PLAYER');

-- CreateEnum
CREATE TYPE "VirtualSeatStatus" AS ENUM ('ACTIVE', 'WAITING_FOR_TURN', 'ACTING', 'FOLDED', 'ALL_IN', 'SIT_OUT_REQUESTED', 'SITTING_OUT', 'RETURN_REQUESTED', 'LEFT', 'NO_CHIPS');

-- CreateEnum
CREATE TYPE "VirtualHandStatus" AS ENUM ('CREATED', 'DEALING', 'IN_PROGRESS', 'SHOWDOWN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HandPlayerStatus" AS ENUM ('ACTIVE', 'FOLDED', 'ALL_IN', 'SITTING_OUT');

-- CreateEnum
CREATE TYPE "Street" AS ENUM ('PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN');

-- CreateEnum
CREATE TYPE "ActionActorType" AS ENUM ('PLAYER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('POST_SMALL_BLIND', 'POST_BIG_BLIND', 'FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN', 'AUTO_CHECK', 'AUTO_FOLD', 'DEAL_HOLE_CARDS', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER', 'SHOWDOWN', 'POT_AWARDED', 'SIT_OUT_REQUESTED', 'SITTING_OUT', 'RETURN_REQUESTED', 'TABLE_PAUSED', 'TABLE_RESUMED', 'BLINDS_RAISED', 'HAND_STARTED', 'HAND_COMPLETED');

-- CreateEnum
CREATE TYPE "PotType" AS ENUM ('MAIN', 'SIDE');

-- CreateEnum
CREATE TYPE "TimeoutAutoActionRule" AS ENUM ('CHECK_OR_FOLD', 'FOLD_ONLY');

-- CreateEnum
CREATE TYPE "TurnTimerStatus" AS ENUM ('ACTIVE', 'REMINDED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TurnTimerResolution" AS ENUM ('PLAYER_ACTION', 'AUTO_CHECK', 'AUTO_FOLD', 'TABLE_PAUSED', 'HAND_COMPLETED');

-- CreateTable
CREATE TABLE "VirtualTable" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "maxSeats" INTEGER NOT NULL DEFAULT 9,
    "startingStackChips" BIGINT NOT NULL,
    "chipValueMinor" BIGINT,
    "chipValueCurrency" TEXT,
    "smallBlindChips" BIGINT NOT NULL,
    "bigBlindChips" BIGINT NOT NULL,
    "pendingSmallBlindChips" BIGINT,
    "pendingBigBlindChips" BIGINT,
    "turnDurationSeconds" INTEGER NOT NULL,
    "reminderDelaySeconds" INTEGER NOT NULL,
    "timeoutAutoActionRule" "TimeoutAutoActionRule" NOT NULL DEFAULT 'CHECK_OR_FOLD',
    "status" "VirtualTableStatus" NOT NULL DEFAULT 'WAITING_FOR_PLAYERS',
    "inviteCode" TEXT NOT NULL,
    "currentHandId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "VirtualTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualSeat" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "displayName" TEXT,
    "role" "VirtualSeatRole" NOT NULL DEFAULT 'PLAYER',
    "status" "VirtualSeatStatus" NOT NULL DEFAULT 'ACTIVE',
    "stackChips" BIGINT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "sitOutRequestedAt" TIMESTAMP(3),
    "sitOutAutoCheckEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sitOutAutoFoldEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hasPassedSmallBlindSinceSitOutRequest" BOOLEAN NOT NULL DEFAULT false,
    "hasPassedBigBlindSinceSitOutRequest" BOOLEAN NOT NULL DEFAULT false,
    "returnRequestedAt" TIMESTAMP(3),

    CONSTRAINT "VirtualSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualHand" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "handNumber" INTEGER NOT NULL,
    "status" "VirtualHandStatus" NOT NULL DEFAULT 'CREATED',
    "dealerSeatId" TEXT NOT NULL,
    "smallBlindSeatId" TEXT NOT NULL,
    "bigBlindSeatId" TEXT NOT NULL,
    "smallBlindChips" BIGINT NOT NULL,
    "bigBlindChips" BIGINT NOT NULL,
    "currentStreet" "Street" NOT NULL DEFAULT 'PRE_FLOP',
    "currentActorSeatId" TEXT,
    "currentBetChips" BIGINT NOT NULL DEFAULT 0,
    "minRaiseChips" BIGINT NOT NULL DEFAULT 0,
    "potTotalChips" BIGINT NOT NULL DEFAULT 0,
    "deckSeedHash" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VirtualHand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualHandPlayer" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "status" "HandPlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "startingStackChips" BIGINT NOT NULL,
    "currentStackChips" BIGINT NOT NULL,
    "committedTotalChips" BIGINT NOT NULL DEFAULT 0,
    "committedStreetChips" BIGINT NOT NULL DEFAULT 0,
    "privateCard1" TEXT,
    "privateCard2" TEXT,
    "hasActedThisStreet" BOOLEAN NOT NULL DEFAULT false,
    "isEligibleForShowdown" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VirtualHandPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityCard" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "street" "Street" NOT NULL,
    "card" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CommunityCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualAction" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "handId" TEXT,
    "seatId" TEXT,
    "actorType" "ActionActorType" NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "amountChips" BIGINT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualPot" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "potType" "PotType" NOT NULL,
    "amountChips" BIGINT NOT NULL,
    "capChips" BIGINT,
    "eligibleSeatIdsJson" JSONB NOT NULL,
    "awardedAt" TIMESTAMP(3),

    CONSTRAINT "VirtualPot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualPotAward" (
    "id" TEXT NOT NULL,
    "potId" TEXT NOT NULL,
    "winnerSeatId" TEXT NOT NULL,
    "amountChips" BIGINT NOT NULL,
    "handRankJson" JSONB,

    CONSTRAINT "VirtualPotAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnTimer" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "status" "TurnTimerStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "reminderDueAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "remindedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionType" "TurnTimerResolution",

    CONSTRAINT "TurnTimer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlinePlayerStats" (
    "userId" TEXT NOT NULL,
    "handsPlayed" INTEGER NOT NULL DEFAULT 0,
    "handsWon" INTEGER NOT NULL DEFAULT 0,
    "totalChipsWon" BIGINT NOT NULL DEFAULT 0,
    "totalChipsLost" BIGINT NOT NULL DEFAULT 0,
    "netChips" BIGINT NOT NULL DEFAULT 0,
    "netEstimatedMinor" BIGINT NOT NULL DEFAULT 0,
    "bigBlindsWon" BIGINT NOT NULL DEFAULT 0,
    "bbPer100Bps" INTEGER NOT NULL DEFAULT 0,
    "winRateBps" INTEGER NOT NULL DEFAULT 0,
    "avgChipsPerHand" BIGINT NOT NULL DEFAULT 0,
    "onlinePokerScore" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlinePlayerStats_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "VirtualTable_inviteCode_key" ON "VirtualTable"("inviteCode");

-- CreateIndex
CREATE INDEX "VirtualTable_ownerUserId_idx" ON "VirtualTable"("ownerUserId");

-- CreateIndex
CREATE INDEX "VirtualTable_status_idx" ON "VirtualTable"("status");

-- CreateIndex
CREATE INDEX "VirtualTable_inviteCode_idx" ON "VirtualTable"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualSeat_tableId_userId_key" ON "VirtualSeat"("tableId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualSeat_tableId_seatNumber_key" ON "VirtualSeat"("tableId", "seatNumber");

-- CreateIndex
CREATE INDEX "VirtualSeat_tableId_idx" ON "VirtualSeat"("tableId");

-- CreateIndex
CREATE INDEX "VirtualSeat_userId_idx" ON "VirtualSeat"("userId");

-- CreateIndex
CREATE INDEX "VirtualSeat_status_idx" ON "VirtualSeat"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualHand_tableId_handNumber_key" ON "VirtualHand"("tableId", "handNumber");

-- CreateIndex
CREATE INDEX "VirtualHand_tableId_idx" ON "VirtualHand"("tableId");

-- CreateIndex
CREATE INDEX "VirtualHand_status_idx" ON "VirtualHand"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualHandPlayer_handId_seatId_key" ON "VirtualHandPlayer"("handId", "seatId");

-- CreateIndex
CREATE INDEX "VirtualHandPlayer_handId_idx" ON "VirtualHandPlayer"("handId");

-- CreateIndex
CREATE INDEX "VirtualHandPlayer_seatId_idx" ON "VirtualHandPlayer"("seatId");

-- CreateIndex
CREATE INDEX "VirtualHandPlayer_status_idx" ON "VirtualHandPlayer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityCard_handId_position_key" ON "CommunityCard"("handId", "position");

-- CreateIndex
CREATE INDEX "CommunityCard_handId_idx" ON "CommunityCard"("handId");

-- CreateIndex
CREATE INDEX "VirtualAction_tableId_idx" ON "VirtualAction"("tableId");

-- CreateIndex
CREATE INDEX "VirtualAction_handId_idx" ON "VirtualAction"("handId");

-- CreateIndex
CREATE INDEX "VirtualAction_seatId_idx" ON "VirtualAction"("seatId");

-- CreateIndex
CREATE INDEX "VirtualAction_createdAt_idx" ON "VirtualAction"("createdAt");

-- CreateIndex
CREATE INDEX "VirtualPot_handId_idx" ON "VirtualPot"("handId");

-- CreateIndex
CREATE INDEX "VirtualPotAward_potId_idx" ON "VirtualPotAward"("potId");

-- CreateIndex
CREATE INDEX "VirtualPotAward_winnerSeatId_idx" ON "VirtualPotAward"("winnerSeatId");

-- CreateIndex
CREATE INDEX "TurnTimer_status_idx" ON "TurnTimer"("status");

-- CreateIndex
CREATE INDEX "TurnTimer_reminderDueAt_idx" ON "TurnTimer"("reminderDueAt");

-- CreateIndex
CREATE INDEX "TurnTimer_expiresAt_idx" ON "TurnTimer"("expiresAt");

-- AddForeignKey
ALTER TABLE "VirtualTable" ADD CONSTRAINT "VirtualTable_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualSeat" ADD CONSTRAINT "VirtualSeat_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "VirtualTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualSeat" ADD CONSTRAINT "VirtualSeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualHand" ADD CONSTRAINT "VirtualHand_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "VirtualTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualHandPlayer" ADD CONSTRAINT "VirtualHandPlayer_handId_fkey" FOREIGN KEY ("handId") REFERENCES "VirtualHand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualHandPlayer" ADD CONSTRAINT "VirtualHandPlayer_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "VirtualSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityCard" ADD CONSTRAINT "CommunityCard_handId_fkey" FOREIGN KEY ("handId") REFERENCES "VirtualHand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualAction" ADD CONSTRAINT "VirtualAction_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "VirtualTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualAction" ADD CONSTRAINT "VirtualAction_handId_fkey" FOREIGN KEY ("handId") REFERENCES "VirtualHand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualAction" ADD CONSTRAINT "VirtualAction_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "VirtualSeat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualPot" ADD CONSTRAINT "VirtualPot_handId_fkey" FOREIGN KEY ("handId") REFERENCES "VirtualHand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualPotAward" ADD CONSTRAINT "VirtualPotAward_potId_fkey" FOREIGN KEY ("potId") REFERENCES "VirtualPot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnTimer" ADD CONSTRAINT "TurnTimer_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "VirtualTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnTimer" ADD CONSTRAINT "TurnTimer_handId_fkey" FOREIGN KEY ("handId") REFERENCES "VirtualHand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnTimer" ADD CONSTRAINT "TurnTimer_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "VirtualSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePlayerStats" ADD CONSTRAINT "OnlinePlayerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
