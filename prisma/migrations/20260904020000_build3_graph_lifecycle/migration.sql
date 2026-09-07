CREATE TYPE "EventSubjectType" AS ENUM ('INSTRUMENT', 'METRIC', 'DRIVER', 'EXTERNAL_DRIVER', 'EVENT_CATEGORY', 'PRICE_CONDITION');
CREATE TYPE "WatchGraphStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'ARCHIVED');
CREATE TYPE "WatchGraphNodeType" AS ENUM ('INSTRUMENT', 'QUESTION', 'METRIC', 'DRIVER', 'EXTERNAL_DRIVER', 'EVENT_CATEGORY', 'PRICE_CONDITION');
CREATE TYPE "WatchGraphRelationship" AS ENUM ('WATCHES', 'RELATES_TO', 'MEASURED_BY', 'AFFECTED_BY', 'TRIGGERED_BY', 'CONTEXT_FOR');
CREATE TYPE "GraphProvenance" AS ENUM ('MANUAL', 'CURATED_TEMPLATE', 'IMPORTED_DEMO');
CREATE TYPE "AcknowledgementScope" AS ENUM ('INSTRUMENT', 'WATCHLIST');

ALTER TABLE "WatchIntent"
  ADD COLUMN "resolvedAt" TIMESTAMPTZ(3),
  ADD COLUMN "resolvedAtSequence" INTEGER,
  ADD COLUMN "lifecycleReviewedThroughSequence" INTEGER;

ALTER TABLE "MarketEvent"
  ADD COLUMN "subjectType" "EventSubjectType",
  ADD COLUMN "subjectKey" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "WatchGraph" (
  "id" TEXT NOT NULL,
  "logicalGraphId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "watchIntentLogicalId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "WatchGraphStatus" NOT NULL DEFAULT 'ACTIVE',
  "provenance" "GraphProvenance" NOT NULL,
  "templateKey" TEXT,
  "effectiveFromSequence" INTEGER NOT NULL,
  "supersedesId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "WatchGraph_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchGraphNode" (
  "id" TEXT NOT NULL,
  "graphId" TEXT NOT NULL,
  "nodeKey" TEXT NOT NULL,
  "type" "WatchGraphNodeType" NOT NULL,
  "label" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WatchGraphNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchGraphEdge" (
  "id" TEXT NOT NULL,
  "graphId" TEXT NOT NULL,
  "fromNodeId" TEXT NOT NULL,
  "toNodeId" TEXT NOT NULL,
  "relationship" "WatchGraphRelationship" NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WatchGraphEdge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeAcknowledgement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "instrumentId" TEXT NOT NULL,
  "fromSequence" INTEGER NOT NULL,
  "throughSequence" INTEGER NOT NULL,
  "scope" "AcknowledgementScope" NOT NULL,
  "acknowledgedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeAcknowledgement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WatchGraph_supersedesId_key" ON "WatchGraph"("supersedesId");
CREATE UNIQUE INDEX "WatchGraph_logicalGraphId_version_key" ON "WatchGraph"("logicalGraphId", "version");
CREATE INDEX "WatchGraph_userId_watchIntentLogicalId_status_idx" ON "WatchGraph"("userId", "watchIntentLogicalId", "status");
CREATE INDEX "WatchGraph_instrumentId_idx" ON "WatchGraph"("instrumentId");
CREATE UNIQUE INDEX "WatchGraphNode_graphId_nodeKey_key" ON "WatchGraphNode"("graphId", "nodeKey");
CREATE INDEX "WatchGraphNode_graphId_type_idx" ON "WatchGraphNode"("graphId", "type");
CREATE UNIQUE INDEX "WatchGraphEdge_graphId_fromNodeId_toNodeId_relationship_key" ON "WatchGraphEdge"("graphId", "fromNodeId", "toNodeId", "relationship");
CREATE INDEX "WatchGraphEdge_fromNodeId_idx" ON "WatchGraphEdge"("fromNodeId");
CREATE INDEX "WatchGraphEdge_toNodeId_idx" ON "WatchGraphEdge"("toNodeId");
CREATE INDEX "KnowledgeAcknowledgement_userId_instrumentId_throughSequence_idx" ON "KnowledgeAcknowledgement"("userId", "instrumentId", "throughSequence");

ALTER TABLE "WatchGraph" ADD CONSTRAINT "WatchGraph_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchGraph" ADD CONSTRAINT "WatchGraph_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WatchGraph" ADD CONSTRAINT "WatchGraph_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "WatchGraph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WatchGraphNode" ADD CONSTRAINT "WatchGraphNode_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "WatchGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchGraphEdge" ADD CONSTRAINT "WatchGraphEdge_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "WatchGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchGraphEdge" ADD CONSTRAINT "WatchGraphEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "WatchGraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchGraphEdge" ADD CONSTRAINT "WatchGraphEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "WatchGraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeAcknowledgement" ADD CONSTRAINT "KnowledgeAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeAcknowledgement" ADD CONSTRAINT "KnowledgeAcknowledgement_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
