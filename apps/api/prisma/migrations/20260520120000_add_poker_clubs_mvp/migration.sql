-- CreateEnum
CREATE TYPE "ClubPrivacy" AS ENUM ('PRIVATE_INVITE_ONLY');

-- CreateEnum
CREATE TYPE "ClubMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ClubMemberStatus" AS ENUM ('ACTIVE', 'REMOVED', 'LEFT', 'INVITED');

-- CreateEnum
CREATE TYPE "ClubEventType" AS ENUM ('OFFLINE_POKER', 'ONLINE_TABLE');

-- CreateEnum
CREATE TYPE "ClubEventStatus" AS ENUM ('SCHEDULED', 'RSVP_OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClubEventRsvpStatus" AS ENUM ('GOING', 'MAYBE', 'DECLINED', 'NO_RESPONSE', 'WAITLIST');

-- AlterTable
ALTER TABLE "Room"
ADD COLUMN "clubId" TEXT,
ADD COLUMN "clubEventId" TEXT,
ADD COLUMN "scheduledStartAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VirtualTable"
ADD COLUMN "clubId" TEXT,
ADD COLUMN "clubEventId" TEXT,
ADD COLUMN "scheduledStartAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "privacy" "ClubPrivacy" NOT NULL DEFAULT 'PRIVATE_INVITE_ONLY',
    "defaultCurrency" TEXT,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubMember" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClubMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "ClubMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayName" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "ClubMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubEvent" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "type" "ClubEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT,
    "status" "ClubEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "maxPlayers" INTEGER,
    "offlineRoomId" TEXT,
    "virtualTableId" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "ClubEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubEventRsvp" (
    "id" TEXT NOT NULL,
    "clubEventId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ClubEventRsvpStatus" NOT NULL DEFAULT 'NO_RESPONSE',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubEventRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_clubEventId_key" ON "Room"("clubEventId");

-- CreateIndex
CREATE INDEX "Room_clubId_idx" ON "Room"("clubId");

-- CreateIndex
CREATE INDEX "Room_scheduledStartAt_idx" ON "Room"("scheduledStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualTable_clubEventId_key" ON "VirtualTable"("clubEventId");

-- CreateIndex
CREATE INDEX "VirtualTable_clubId_idx" ON "VirtualTable"("clubId");

-- CreateIndex
CREATE INDEX "VirtualTable_scheduledStartAt_idx" ON "VirtualTable"("scheduledStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "Club_inviteCode_key" ON "Club"("inviteCode");

-- CreateIndex
CREATE INDEX "Club_ownerUserId_idx" ON "Club"("ownerUserId");

-- CreateIndex
CREATE INDEX "Club_inviteCode_idx" ON "Club"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMember_clubId_userId_key" ON "ClubMember"("clubId", "userId");

-- CreateIndex
CREATE INDEX "ClubMember_clubId_idx" ON "ClubMember"("clubId");

-- CreateIndex
CREATE INDEX "ClubMember_userId_idx" ON "ClubMember"("userId");

-- CreateIndex
CREATE INDEX "ClubMember_status_idx" ON "ClubMember"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClubEvent_offlineRoomId_key" ON "ClubEvent"("offlineRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubEvent_virtualTableId_key" ON "ClubEvent"("virtualTableId");

-- CreateIndex
CREATE INDEX "ClubEvent_clubId_idx" ON "ClubEvent"("clubId");

-- CreateIndex
CREATE INDEX "ClubEvent_createdByUserId_idx" ON "ClubEvent"("createdByUserId");

-- CreateIndex
CREATE INDEX "ClubEvent_status_idx" ON "ClubEvent"("status");

-- CreateIndex
CREATE INDEX "ClubEvent_scheduledStartAt_idx" ON "ClubEvent"("scheduledStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClubEventRsvp_clubEventId_userId_key" ON "ClubEventRsvp"("clubEventId", "userId");

-- CreateIndex
CREATE INDEX "ClubEventRsvp_clubId_idx" ON "ClubEventRsvp"("clubId");

-- CreateIndex
CREATE INDEX "ClubEventRsvp_userId_idx" ON "ClubEventRsvp"("userId");

-- CreateIndex
CREATE INDEX "ClubEventRsvp_clubEventId_status_idx" ON "ClubEventRsvp"("clubEventId", "status");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_clubEventId_fkey" FOREIGN KEY ("clubEventId") REFERENCES "ClubEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualTable" ADD CONSTRAINT "VirtualTable_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualTable" ADD CONSTRAINT "VirtualTable_clubEventId_fkey" FOREIGN KEY ("clubEventId") REFERENCES "ClubEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubEvent" ADD CONSTRAINT "ClubEvent_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubEvent" ADD CONSTRAINT "ClubEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubEvent" ADD CONSTRAINT "ClubEvent_offlineRoomId_fkey" FOREIGN KEY ("offlineRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubEvent" ADD CONSTRAINT "ClubEvent_virtualTableId_fkey" FOREIGN KEY ("virtualTableId") REFERENCES "VirtualTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubEventRsvp" ADD CONSTRAINT "ClubEventRsvp_clubEventId_fkey" FOREIGN KEY ("clubEventId") REFERENCES "ClubEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubEventRsvp" ADD CONSTRAINT "ClubEventRsvp_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubEventRsvp" ADD CONSTRAINT "ClubEventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
