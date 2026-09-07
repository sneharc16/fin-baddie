ALTER TABLE "WatchIntent" ADD COLUMN "effectiveFromSequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WatchIntent" ALTER COLUMN "effectiveFromSequence" DROP DEFAULT;

ALTER TABLE "MarketSnapshot" ADD COLUMN "expectedStepMoveBps" INTEGER;
