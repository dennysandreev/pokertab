ALTER TABLE "Room"
ADD COLUMN "buyInChips" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "rebuyChips" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "chipsPerCurrencyUnit" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "RoomPlayer"
ADD COLUMN "finalAmountChips" BIGINT,
ADD COLUMN "netResultChips" BIGINT;

ALTER TABLE "RebuyEvent"
ADD COLUMN "amountChips" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "Settlement"
ADD COLUMN "totalBuyinsChips" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "totalFinalAmountChips" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "differenceChips" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "SettlementTransfer"
ADD COLUMN "amountChips" BIGINT NOT NULL DEFAULT 0;

UPDATE "Room"
SET
  "buyInChips" = COALESCE("startingStack", 1000),
  "rebuyChips" = CASE
    WHEN "rebuyAmountMinor" > 0 THEN "rebuyAmountMinor" / 100
    ELSE 0
  END,
  "chipsPerCurrencyUnit" = 1;

UPDATE "RoomPlayer"
SET
  "finalAmountChips" = CASE
    WHEN "finalAmountMinor" IS NULL THEN NULL
    ELSE "finalAmountMinor" / 100
  END,
  "netResultChips" = CASE
    WHEN "netResultMinor" IS NULL THEN NULL
    ELSE "netResultMinor" / 100
  END;

UPDATE "RebuyEvent"
SET "amountChips" = "amountMinor" / 100;

UPDATE "Settlement"
SET
  "totalBuyinsChips" = "totalBuyinsMinor" / 100,
  "totalFinalAmountChips" = "totalFinalAmountMinor" / 100,
  "differenceChips" = "differenceMinor" / 100;

UPDATE "SettlementTransfer"
SET "amountChips" = "amountMinor" / 100;
