CREATE TYPE "IntentType" AS ENUM ('PRICE_LEVEL', 'EARNINGS', 'DIVIDEND', 'TECHNICAL', 'COMPANY_EVENT', 'DRIVER', 'LONG_TERM', 'GENERAL');
CREATE TYPE "IntentStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'RESOLVED', 'ARCHIVED');
CREATE TYPE "ProvenanceSource" AS ENUM ('MANUAL', 'STOCK_DETAIL', 'SCREENER_NEAR_BREAKOUT', 'RESULTS_CALENDAR', 'DIVIDEND_SCREEN', 'NEWS_CONTEXT', 'IMPORTED_DEMO');
CREATE TYPE "MarketQuality" AS ENUM ('FRESH', 'DELAYED', 'STALE', 'CONFLICTING', 'CORRECTED');
CREATE TYPE "MarketEventType" AS ENUM ('QUOTE_UPDATE', 'RESULTS_PUBLISHED', 'TECHNICAL_TRANSITION', 'CORPORATE_EVENT', 'EXTERNAL_DRIVER', 'NEWS_EVENT');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Instrument" (
  "id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "exchange" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sector" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
  CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Watchlist" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
  CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchlistItem" (
  "id" TEXT NOT NULL,
  "watchlistId" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3) WITH TIME ZONE,
  "provenanceSource" "ProvenanceSource" NOT NULL,
  "provenanceReference" TEXT,
  CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchIntent" (
  "id" TEXT NOT NULL,
  "logicalIntentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "type" "IntentType" NOT NULL,
  "originalText" TEXT,
  "structuredPayload" JSONB NOT NULL,
  "provenanceSource" "ProvenanceSource" NOT NULL,
  "provenanceReference" TEXT,
  "status" "IntentStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL,
  "supersedesId" TEXT,
  "horizon" TEXT,
  "expiresAt" TIMESTAMP(3) WITH TIME ZONE,
  "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
  CONSTRAINT "WatchIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketSnapshot" (
  "id" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "eventTime" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
  "pricePaise" INTEGER NOT NULL,
  "openPaise" INTEGER NOT NULL,
  "highPaise" INTEGER NOT NULL,
  "lowPaise" INTEGER NOT NULL,
  "cumulativeVolume" BIGINT NOT NULL,
  "expectedCumulativeVolume" BIGINT,
  "source" TEXT NOT NULL,
  "quality" "MarketQuality" NOT NULL,
  "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeCursor" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "lastSeenSequence" INTEGER NOT NULL,
  "lastSeenEventTime" TIMESTAMP(3) WITH TIME ZONE,
  "lastObservedSnapshotId" TEXT,
  "cursorVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
  CONSTRAINT "KnowledgeCursor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketEvent" (
  "id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "instrumentId" TEXT,
  "type" "MarketEventType" NOT NULL,
  "eventTime" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
  "receivedTime" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
  "source" TEXT NOT NULL,
  "quality" "MarketQuality" NOT NULL,
  "payload" JSONB NOT NULL,
  "correctionOfId" TEXT,
  "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DemoSession" (
  "id" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "currentStep" INTEGER NOT NULL,
  "currentSequence" INTEGER NOT NULL,
  "currentTime" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
  "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
  CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Instrument_exchange_symbol_key" ON "Instrument"("exchange", "symbol");
CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");
CREATE INDEX "WatchlistItem_watchlistId_archivedAt_idx" ON "WatchlistItem"("watchlistId", "archivedAt");
CREATE INDEX "WatchlistItem_instrumentId_idx" ON "WatchlistItem"("instrumentId");
CREATE UNIQUE INDEX "WatchlistItem_one_active_per_instrument" ON "WatchlistItem"("watchlistId", "instrumentId") WHERE "archivedAt" IS NULL;
CREATE UNIQUE INDEX "WatchIntent_supersedesId_key" ON "WatchIntent"("supersedesId");
CREATE UNIQUE INDEX "WatchIntent_logicalIntentId_version_key" ON "WatchIntent"("logicalIntentId", "version");
CREATE INDEX "WatchIntent_userId_instrumentId_status_idx" ON "WatchIntent"("userId", "instrumentId", "status");
CREATE UNIQUE INDEX "MarketSnapshot_instrumentId_sequence_key" ON "MarketSnapshot"("instrumentId", "sequence");
CREATE INDEX "MarketSnapshot_sequence_idx" ON "MarketSnapshot"("sequence");
CREATE UNIQUE INDEX "KnowledgeCursor_userId_instrumentId_key" ON "KnowledgeCursor"("userId", "instrumentId");
CREATE INDEX "MarketEvent_sequence_idx" ON "MarketEvent"("sequence");
CREATE INDEX "MarketEvent_instrumentId_sequence_idx" ON "MarketEvent"("instrumentId", "sequence");

ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WatchIntent" ADD CONSTRAINT "WatchIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchIntent" ADD CONSTRAINT "WatchIntent_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WatchIntent" ADD CONSTRAINT "WatchIntent_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "WatchIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketSnapshot" ADD CONSTRAINT "MarketSnapshot_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeCursor" ADD CONSTRAINT "KnowledgeCursor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeCursor" ADD CONSTRAINT "KnowledgeCursor_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeCursor" ADD CONSTRAINT "KnowledgeCursor_lastObservedSnapshotId_fkey" FOREIGN KEY ("lastObservedSnapshotId") REFERENCES "MarketSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketEvent" ADD CONSTRAINT "MarketEvent_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketEvent" ADD CONSTRAINT "MarketEvent_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "MarketEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
