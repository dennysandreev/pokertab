-- AlterTable
ALTER TABLE "VirtualTable" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "VirtualTable_isPrivate_status_idx" ON "VirtualTable"("isPrivate", "status");
