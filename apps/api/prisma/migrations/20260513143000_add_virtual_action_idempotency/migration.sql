ALTER TABLE "VirtualAction"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "VirtualAction_tableId_seatId_idempotencyKey_key"
ON "VirtualAction"("tableId", "seatId", "idempotencyKey");
