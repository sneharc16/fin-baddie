import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { defaultReplayScenario, replayInstruments } from "../data/replay/default-scenario";
import { findDriverTemplate, graphDraftFromTemplate } from "../src/domain/graph/templates";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for seeding.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });

const seededIntents = [
  {
    id: "intent-version:tcs:earnings:1",
    logicalIntentId: "intent:tcs:earnings",
    instrumentId: "NSE:TCS",
    type: "EARNINGS" as const,
    originalText: "Watching Q2 margins",
    structuredPayload: { focus: ["MARGINS"], quarterLabel: "Q2" },
    provenanceSource: "RESULTS_CALENDAR" as const,
  },
  {
    id: "intent-version:hdfcbank:price:1",
    logicalIntentId: "intent:hdfcbank:price",
    instrumentId: "NSE:HDFCBANK",
    type: "PRICE_LEVEL" as const,
    originalText: "Watching near ₹1,550",
    structuredPayload: { targetPricePaise: 155000, mode: "NEAR", proximityBps: 100 },
    provenanceSource: "MANUAL" as const,
  },
  {
    id: "intent-version:tatamotors:technical:1",
    logicalIntentId: "intent:tatamotors:technical",
    instrumentId: "NSE:TATAMOTORS",
    type: "TECHNICAL" as const,
    originalText: "Watching for a breakout near ₹1,000",
    structuredPayload: { setup: "BREAKOUT", referenceLevelPaise: 100000 },
    provenanceSource: "SCREENER_NEAR_BREAKOUT" as const,
  },
  {
    id: "intent-version:indigo:driver:1",
    logicalIntentId: "intent:indigo:driver",
    instrumentId: "NSE:INDIGO",
    type: "DRIVER" as const,
    originalText: "Watching fuel-cost conditions ahead of results",
    structuredPayload: { driverKey: "FUEL_COST", description: "Track material fuel-cost changes relevant to the saved watch reason" },
    provenanceSource: "MANUAL" as const,
  },
];

async function main() {
  await prisma.user.upsert({
    where: { id: "demo-user" },
    update: { displayName: "Demo Investor" },
    create: { id: "demo-user", displayName: "Demo Investor" },
  });

  for (const instrument of replayInstruments) {
    await prisma.instrument.upsert({
      where: { id: instrument.id },
      update: { symbol: instrument.symbol, exchange: instrument.exchange, name: instrument.name, sector: instrument.sector, currency: "INR", isActive: true },
      create: { ...instrument, currency: "INR", isActive: true },
    });
  }

  await prisma.watchlist.upsert({
    where: { id: "demo-watchlist" },
    update: { name: "My Watchlist" },
    create: { id: "demo-watchlist", userId: "demo-user", name: "My Watchlist" },
  });

  for (const instrument of replayInstruments) {
    await prisma.watchlistItem.upsert({
      where: { id: `watchlist-item:${instrument.symbol.toLowerCase()}` },
      update: {},
      create: {
        id: `watchlist-item:${instrument.symbol.toLowerCase()}`,
        watchlistId: "demo-watchlist",
        instrumentId: instrument.id,
        provenanceSource: "IMPORTED_DEMO",
        provenanceReference: "groww-delta-default",
      },
    });
  }

  for (const intent of seededIntents) {
    await prisma.watchIntent.upsert({
      where: { id: intent.id },
      update: {},
      create: {
        ...intent,
        userId: "demo-user",
        structuredPayload: intent.structuredPayload as Prisma.InputJsonValue,
        status: "ACTIVE",
        version: 1,
        effectiveFromSequence: 0,
      },
    });
  }

  const indigoGraphId = "watch-graph:indigo:fuel-cost:1";
  const indigoTemplate = findDriverTemplate("AIRLINE_FUEL_COST", "NSE:INDIGO");
  const indigoGraph = graphDraftFromTemplate(indigoTemplate, ["FUEL_COST", "CRUDE"]);
  await prisma.watchGraph.upsert({
    where: { id: indigoGraphId },
    update: {},
    create: {
      id: indigoGraphId,
      logicalGraphId: "watch-graph:indigo:fuel-cost",
      userId: "demo-user",
      instrumentId: "NSE:INDIGO",
      watchIntentLogicalId: "intent:indigo:driver",
      version: 1,
      status: "ACTIVE",
      provenance: "IMPORTED_DEMO",
      templateKey: indigoTemplate.key,
      effectiveFromSequence: 0,
      nodes: {
        create: indigoGraph.nodes.map((node) => ({
          id: `${indigoGraphId}:node:${node.nodeKey.toLowerCase()}`,
          nodeKey: node.nodeKey,
          type: node.type,
          label: node.label,
          metadata: (node.metadata ?? {}) as Prisma.InputJsonValue,
        })),
      },
    },
  });
  const indigoNodeId = (nodeKey: string) => `${indigoGraphId}:node:${nodeKey.toLowerCase()}`;
  for (const [index, edge] of indigoGraph.edges.entries()) {
    await prisma.watchGraphEdge.upsert({
      where: { id: `${indigoGraphId}:edge:${index}` },
      update: {},
      create: {
        id: `${indigoGraphId}:edge:${index}`,
        graphId: indigoGraphId,
        fromNodeId: indigoNodeId(edge.fromKey),
        toNodeId: indigoNodeId(edge.toKey),
        relationship: edge.relationship,
        weight: edge.weight,
      },
    });
  }

  for (const step of defaultReplayScenario.steps) {
    for (const snapshot of step.snapshots) {
      const id = `snapshot:${step.sequence}:${snapshot.instrumentId}`;
      await prisma.marketSnapshot.upsert({
        where: { id },
        update: {
          eventTime: new Date(step.eventTime),
          pricePaise: snapshot.pricePaise,
          openPaise: snapshot.openPaise,
          highPaise: snapshot.highPaise,
          lowPaise: snapshot.lowPaise,
          cumulativeVolume: snapshot.cumulativeVolume,
          expectedCumulativeVolume: snapshot.expectedCumulativeVolume,
          expectedStepMoveBps: snapshot.expectedStepMoveBps,
          source: "ReplayMarketProvider",
          quality: "FRESH",
        },
        create: {
          id,
          instrumentId: snapshot.instrumentId,
          sequence: step.sequence,
          eventTime: new Date(step.eventTime),
          pricePaise: snapshot.pricePaise,
          openPaise: snapshot.openPaise,
          highPaise: snapshot.highPaise,
          lowPaise: snapshot.lowPaise,
          cumulativeVolume: snapshot.cumulativeVolume,
          expectedCumulativeVolume: snapshot.expectedCumulativeVolume,
          expectedStepMoveBps: snapshot.expectedStepMoveBps,
          source: "ReplayMarketProvider",
          quality: "FRESH",
        },
      });
    }
  }

  for (const event of defaultReplayScenario.events) {
    await prisma.marketEvent.upsert({
      where: { id: event.id },
      update: {
        eventTime: new Date(event.eventTime),
        receivedTime: new Date(event.eventTime),
        subjectType: event.subjectType,
        subjectKey: event.subjectKey,
        tags: event.tags,
        payload: event.payload as Prisma.InputJsonValue,
      },
      create: {
        ...event,
        eventTime: new Date(event.eventTime),
        receivedTime: new Date(event.eventTime),
        source: "ReplayMarketProvider",
        quality: "FRESH",
        payload: event.payload as Prisma.InputJsonValue,
      },
    });
  }

  const initialStep = defaultReplayScenario.steps[0];
  for (const instrument of replayInstruments) {
    await prisma.knowledgeCursor.upsert({
      where: { userId_instrumentId: { userId: "demo-user", instrumentId: instrument.id } },
      update: {},
      create: {
        id: `cursor:${instrument.symbol.toLowerCase()}`,
        userId: "demo-user",
        instrumentId: instrument.id,
        lastSeenSequence: initialStep.sequence,
        lastSeenEventTime: new Date(initialStep.eventTime),
        lastObservedSnapshotId: `snapshot:${initialStep.sequence}:${instrument.id}`,
        cursorVersion: 1,
      },
    });
  }

  await prisma.demoSession.upsert({
    where: { id: "default-demo-session" },
    update: {},
    create: {
      id: "default-demo-session",
      scenarioId: defaultReplayScenario.id,
      currentStep: initialStep.step,
      currentSequence: initialStep.sequence,
      currentTime: new Date(initialStep.eventTime),
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
