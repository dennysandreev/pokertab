-- CreateTable
CREATE TABLE "VirtualTableReaction" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualTableReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VirtualTableReaction_tableId_createdAt_idx" ON "VirtualTableReaction"("tableId", "createdAt");

-- CreateIndex
CREATE INDEX "VirtualTableReaction_seatId_createdAt_idx" ON "VirtualTableReaction"("seatId", "createdAt");

-- AddForeignKey
ALTER TABLE "VirtualTableReaction" ADD CONSTRAINT "VirtualTableReaction_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "VirtualTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualTableReaction" ADD CONSTRAINT "VirtualTableReaction_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "VirtualSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualTableReaction" ADD CONSTRAINT "VirtualTableReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
