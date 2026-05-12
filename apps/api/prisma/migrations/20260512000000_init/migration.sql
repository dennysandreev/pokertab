-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('DRAFT', 'WAITING', 'RUNNING', 'SETTLEMENT', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoomPlayerRole" AS ENUM ('OWNER', 'ADMIN', 'PLAYER');

-- CreateEnum
CREATE TYPE "RoomPlayerStatus" AS ENUM ('ACTIVE', 'REMOVED', 'LEFT');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('CASH', 'TOURNAMENT', 'SIMPLE_TRACKING');

-- CreateEnum
CREATE TYPE "RebuyPermission" AS ENUM ('PLAYER_SELF', 'ADMIN_APPROVAL', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "RebuyEventSource" AS ENUM ('PLAYER_SELF', 'ADMIN_FOR_PLAYER', 'SYSTEM_IMPORT');

-- CreateEnum
CREATE TYPE "RebuyEventStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IdempotencyAction" AS ENUM ('CREATE_REBUY', 'CANCEL_REBUY');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'VALID', 'CLOSED');

-- CreateEnum
CREATE TYPE "SettlementTransferStatus" AS ENUM ('PENDING', 'MARKED_PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rebuyAmountMinor" BIGINT NOT NULL,
    "startingStack" INTEGER,
    "gameType" "GameType" NOT NULL DEFAULT 'SIMPLE_TRACKING',
    "rebuyPermission" "RebuyPermission" NOT NULL DEFAULT 'PLAYER_SELF',
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "settlementStartedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPlayer" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "RoomPlayerRole" NOT NULL DEFAULT 'PLAYER',
    "status" "RoomPlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "finalAmountMinor" BIGINT,
    "netResultMinor" BIGINT,

    CONSTRAINT "RoomPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RebuyEvent" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomPlayerId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "source" "RebuyEventSource" NOT NULL,
    "status" "RebuyEventStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancellationReason" TEXT,

    CONSTRAINT "RebuyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "action" "IdempotencyAction" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" JSONB,
    "rebuyEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "totalBuyinsMinor" BIGINT NOT NULL,
    "totalFinalAmountMinor" BIGINT NOT NULL,
    "differenceMinor" BIGINT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedByUserId" TEXT,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementTransfer" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "fromRoomPlayerId" TEXT NOT NULL,
    "toRoomPlayerId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "status" "SettlementTransferStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "SettlementTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerStats" (
    "userId" TEXT NOT NULL,
    "gamesCount" INTEGER NOT NULL DEFAULT 0,
    "totalBuyinsMinor" BIGINT NOT NULL DEFAULT 0,
    "totalProfitMinor" BIGINT NOT NULL DEFAULT 0,
    "avgProfitMinor" BIGINT NOT NULL DEFAULT 0,
    "roiBps" INTEGER NOT NULL DEFAULT 0,
    "winRateBps" INTEGER NOT NULL DEFAULT 0,
    "stabilityScoreBps" INTEGER NOT NULL DEFAULT 0,
    "pokerScore" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerStats_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_telegramId_idx" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_inviteCode_key" ON "Room"("inviteCode");

-- CreateIndex
CREATE INDEX "Room_ownerUserId_idx" ON "Room"("ownerUserId");

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE INDEX "Room_inviteCode_idx" ON "Room"("inviteCode");

-- CreateIndex
CREATE INDEX "RoomPlayer_roomId_idx" ON "RoomPlayer"("roomId");

-- CreateIndex
CREATE INDEX "RoomPlayer_userId_idx" ON "RoomPlayer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlayer_roomId_userId_key" ON "RoomPlayer"("roomId", "userId");

-- CreateIndex
CREATE INDEX "RebuyEvent_roomId_createdAt_idx" ON "RebuyEvent"("roomId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RebuyEvent_roomPlayerId_status_idx" ON "RebuyEvent"("roomPlayerId", "status");

-- CreateIndex
CREATE INDEX "RebuyEvent_createdByUserId_idx" ON "RebuyEvent"("createdByUserId");

-- CreateIndex
CREATE INDEX "RebuyEvent_cancelledByUserId_idx" ON "RebuyEvent"("cancelledByUserId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_roomId_idx" ON "IdempotencyKey"("roomId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_rebuyEventId_idx" ON "IdempotencyKey"("rebuyEventId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_userId_action_idempotencyKey_key" ON "IdempotencyKey"("userId", "action", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Settlement_roomId_idx" ON "Settlement"("roomId");

-- CreateIndex
CREATE INDEX "Settlement_closedByUserId_idx" ON "Settlement"("closedByUserId");

-- CreateIndex
CREATE INDEX "SettlementTransfer_settlementId_idx" ON "SettlementTransfer"("settlementId");

-- CreateIndex
CREATE INDEX "SettlementTransfer_fromRoomPlayerId_idx" ON "SettlementTransfer"("fromRoomPlayerId");

-- CreateIndex
CREATE INDEX "SettlementTransfer_toRoomPlayerId_idx" ON "SettlementTransfer"("toRoomPlayerId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuyEvent" ADD CONSTRAINT "RebuyEvent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuyEvent" ADD CONSTRAINT "RebuyEvent_roomPlayerId_fkey" FOREIGN KEY ("roomPlayerId") REFERENCES "RoomPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuyEvent" ADD CONSTRAINT "RebuyEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuyEvent" ADD CONSTRAINT "RebuyEvent_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_rebuyEventId_fkey" FOREIGN KEY ("rebuyEventId") REFERENCES "RebuyEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementTransfer" ADD CONSTRAINT "SettlementTransfer_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementTransfer" ADD CONSTRAINT "SettlementTransfer_fromRoomPlayerId_fkey" FOREIGN KEY ("fromRoomPlayerId") REFERENCES "RoomPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementTransfer" ADD CONSTRAINT "SettlementTransfer_toRoomPlayerId_fkey" FOREIGN KEY ("toRoomPlayerId") REFERENCES "RoomPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStats" ADD CONSTRAINT "PlayerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
