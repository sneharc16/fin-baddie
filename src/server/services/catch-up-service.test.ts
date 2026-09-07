import { beforeEach, describe, expect, it } from "vitest";
import { defaultReplayScenario, replayInstruments } from "../../../data/replay/default-scenario";
import type { InstrumentRecord } from "@/domain/instrument/types";
import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import type { WatchIntentRecord } from "@/domain/intent/types";
import type { WatchlistItemRecord } from "@/server/repositories/contracts";
import { ReplayMarketProvider } from "@/server/market/providers/replay-market-provider";
import { CatchUpService } from "./catch-up-service";
import {
  MemoryDemoSessionRepository,
  MemoryEventRepository,
  MemoryIntentRepository,
  MemoryKnowledgeCursorRepository,
  MemoryKnowledgeAcknowledgementRepository,
  MemoryWatchGraphRepository,
  MemorySnapshotRepository,
  MemoryWatchlistRepository,
  cursorRecord,
  graphRecord,
  intentRecord,
  watchlistRecord,
} from "../../../tests/helpers/in-memory";
import { findDriverTemplate, graphDraftFromTemplate } from "@/domain/graph/templates";

const instruments: InstrumentRecord[] = replayInstruments.map((instrument) => ({ ...instrument, currency: "INR", isActive: true }));
const snapshots: MarketSnapshotRecord[] = defaultReplayScenario.steps.flatMap((step) => step.snapshots.map((snapshot) => ({
  id: `snapshot:${step.sequence}:${snapshot.instrumentId}`,
  ...snapshot,
  sequence: step.sequence,
  eventTime: new Date(step.eventTime),
  source: "ReplayMarketProvider",
  quality: "FRESH" as const,
})));
const events: MarketEventRecord[] = defaultReplayScenario.events.map((event) => ({
  ...event,
  eventTime: new Date(event.eventTime), receivedTime: new Date(event.eventTime), source: "ReplayMarketProvider",
  quality: "FRESH", correctionOfId: null,
}));
const seededIntents: WatchIntentRecord[] = [
  intentRecord({ id: "tcs-v1", logicalIntentId: "tcs-results", instrumentId: "NSE:TCS", type: "EARNINGS", originalText: "Watching Q2 margins", structuredPayload: { focus: ["MARGINS"], quarterLabel: "Q2" }, provenanceSource: "RESULTS_CALENDAR" }),
  intentRecord({ id: "hdfc-v1", logicalIntentId: "hdfc-price", instrumentId: "NSE:HDFCBANK", type: "PRICE_LEVEL", originalText: "Watching near ₹1,550", structuredPayload: { targetPricePaise: 155000, mode: "NEAR", proximityBps: 100 } }),
  intentRecord({ id: "tata-v1", logicalIntentId: "tata-tech", instrumentId: "NSE:TATAMOTORS", type: "TECHNICAL", originalText: "Watching for a breakout near ₹1,000", structuredPayload: { setup: "BREAKOUT", referenceLevelPaise: 100000 }, provenanceSource: "SCREENER_NEAR_BREAKOUT" }),
  intentRecord({ id: "indigo-v1", logicalIntentId: "indigo-driver", instrumentId: "NSE:INDIGO", type: "DRIVER", originalText: "Watching fuel-cost conditions ahead of results", structuredPayload: { driverKey: "FUEL_COST", description: "Track material fuel-cost changes relevant to the saved watch reason" } }),
];

function scenario() {
  const watchlistItems: WatchlistItemRecord[] = instruments.map((instrument) => ({
    id: `item-${instrument.symbol}`, watchlistId: "demo-watchlist", instrumentId: instrument.id, addedAt: new Date(), archivedAt: null,
    provenanceSource: "IMPORTED_DEMO", provenanceReference: defaultReplayScenario.id, instrument,
  }));
  const sessions = new MemoryDemoSessionRepository();
  const cursorRows = instruments.map((instrument) => cursorRecord({
    id: `cursor-${instrument.symbol}`, instrumentId: instrument.id, lastObservedSnapshotId: `snapshot:0:${instrument.id}`,
  }));
  const cursors = new MemoryKnowledgeCursorRepository(cursorRows);
  const watchlists = new MemoryWatchlistRepository(watchlistRecord(watchlistItems));
  const intents = new MemoryIntentRepository(seededIntents.map((intent) => ({ ...intent })));
  const provider = new ReplayMarketProvider(sessions, new MemorySnapshotRepository(snapshots), new MemoryEventRepository(events));
  const acknowledgements = new MemoryKnowledgeAcknowledgementRepository();
  const indigoTemplate = findDriverTemplate("AIRLINE_FUEL_COST", "NSE:INDIGO");
  const graphs = new MemoryWatchGraphRepository([
    graphRecord(graphDraftFromTemplate(indigoTemplate, ["FUEL_COST", "CRUDE"])),
  ]);
  const service = new CatchUpService(watchlists, cursors, intents, sessions, provider, graphs, acknowledgements);
  return { service, sessions, cursors, watchlists, intents, provider, graphs, acknowledgements };
}

async function moveTo(sessions: MemoryDemoSessionRepository, stepIndex: number) {
  const step = defaultReplayScenario.steps[stepIndex];
  await sessions.setPosition("default-demo-session", step.step, step.sequence, new Date(step.eventTime));
}

describe("CatchUpService default scenario", () => {
  let setup: ReturnType<typeof scenario>;
  beforeEach(() => { setup = scenario(); });

  it("is caught up at Step 0 without mutating cursor state", async () => {
    const before = setup.cursors.rows.map((cursor) => ({ sequence: cursor.lastSeenSequence, version: cursor.cursorVersion }));
    const result = await setup.service.getCatchUp("demo-user");
    expect(result.counts).toEqual({ relevant: 0, significant: 0, quiet: 5 });
    expect(setup.cursors.rows.map((cursor) => ({ sequence: cursor.lastSeenSequence, version: cursor.cursorVersion }))).toEqual(before);
  });

  it("suppresses ordinary Step 1 movement", async () => {
    await moveTo(setup.sessions, 1);
    const result = await setup.service.getCatchUp("demo-user");
    expect(result.counts).toEqual({ relevant: 0, significant: 0, quiet: 5 });
    expect(result.quiet.every((item) => item.novelty === 100)).toBe(true);
  });

  it("derives four relevant and one significant item at Step 2", async () => {
    await moveTo(setup.sessions, 2);
    const result = await setup.service.getCatchUp("demo-user");
    expect(result.counts).toEqual({ relevant: 4, significant: 1, quiet: 0 });
    expect(result.relevant.map((item) => item.instrument.symbol).sort()).toEqual(["HDFCBANK", "INDIGO", "TATAMOTORS", "TCS"]);
    expect(result.significant.map((item) => item.instrument.symbol)).toEqual(["RELIANCE"]);
    expect(result.relevant.find((item) => item.instrument.symbol === "TCS")?.reasonCodes).toContain("EARNINGS_EVENT_MATCHED");
    expect(result.relevant.find((item) => item.instrument.symbol === "HDFCBANK")?.reasonCodes).toContain("PRICE_TARGET_NEAR_ENTERED");
    expect(result.relevant.find((item) => item.instrument.symbol === "TATAMOTORS")?.reasonCodes).toEqual(expect.arrayContaining(["TECHNICAL_SETUP_MATCHED", "UNUSUAL_VOLUME", "MULTIPLE_SIGNALS"]));
    expect(result.relevant.find((item) => item.instrument.symbol === "INDIGO")?.reasonCodes).toContain("DRIVER_EVENT_MATCHED");
    expect(result.relevant.find((item) => item.instrument.symbol === "INDIGO")?.matchedIntents.every((match) => match.matchType === "DIRECT")).toBe(true);
    expect(result.relevant.find((item) => item.instrument.symbol === "INDIGO")?.relevance).toBe(100);
    expect(result.significant[0].reasonCodes).toContain("UNUSUAL_PRICE_MOVE");
  });

  it("acknowledges one instrument without moving the others", async () => {
    await moveTo(setup.sessions, 2);
    await setup.service.acknowledge("demo-user", { instrumentIds: ["NSE:TCS"], throughSequence: 2 });
    expect(setup.cursors.rows.find((cursor) => cursor.instrumentId === "NSE:TCS")?.lastSeenSequence).toBe(2);
    expect(setup.cursors.rows.filter((cursor) => cursor.instrumentId !== "NSE:TCS").every((cursor) => cursor.lastSeenSequence === 0)).toBe(true);
    expect((await setup.service.getCatchUp("demo-user")).relevant.map((item) => item.instrument.symbol)).not.toContain("TCS");
    expect(setup.acknowledgements.rows).toEqual([expect.objectContaining({ instrumentId: "NSE:TCS", fromSequence: 0, throughSequence: 2, scope: "INSTRUMENT" })]);
  });

  it("mark-all catches up every active instrument and Step 3 does not repeat Step 2", async () => {
    await moveTo(setup.sessions, 2);
    await setup.service.acknowledge("demo-user", { scope: "ALL", throughSequence: 2 });
    expect(setup.acknowledgements.rows).toHaveLength(5);
    expect(setup.acknowledgements.rows.every((row) => row.scope === "WATCHLIST")).toBe(true);
    expect((await setup.service.getCatchUp("demo-user")).counts).toEqual({ relevant: 0, significant: 0, quiet: 5 });
    await moveTo(setup.sessions, 3);
    const step3 = await setup.service.getCatchUp("demo-user");
    expect(step3.counts).toEqual({ relevant: 0, significant: 0, quiet: 5 });
    expect(step3.relevant).toEqual([]);
    expect(step3.significant).toEqual([]);
  });

  it("derives Step 4 IndiGo relevance from the configured Crude path, not direct matching", async () => {
    await moveTo(setup.sessions, 2);
    await setup.service.acknowledge("demo-user", { scope: "ALL", throughSequence: 2 });
    await moveTo(setup.sessions, 3);
    expect((await setup.service.getCatchUp("demo-user")).counts).toEqual({ relevant: 0, significant: 0, quiet: 5 });
    await moveTo(setup.sessions, 4);
    const result = await setup.service.getCatchUp("demo-user");
    expect(result.counts).toEqual({ relevant: 1, significant: 0, quiet: 4 });
    const indigo = result.relevant[0];
    expect(indigo.instrument.symbol).toBe("INDIGO");
    expect(indigo.matchedIntents).toHaveLength(1);
    expect(indigo.matchedIntents[0]).toMatchObject({ matchType: "GRAPH", relevance: 85 });
    expect(indigo.reasonCodes).toEqual(expect.arrayContaining(["GRAPH_RELEVANCE_MATCHED", "RELATED_DRIVER_CHANGED"]));
    expect(indigo.relevancePaths[0].map((node) => node.key)).toEqual(["NSE:INDIGO", "FUEL_COST", "CRUDE"]);
    expect(indigo.priceSignificance).toBeLessThan(50);
    expect(indigo.matchedIntents.some((match) => match.matchType === "DIRECT")).toBe(false);
  });

  it("does not advance an archived watchlist instrument during mark-all", async () => {
    setup.watchlists.record.items[4].archivedAt = new Date();
    await moveTo(setup.sessions, 2);
    await setup.service.acknowledge("demo-user", { scope: "ALL", throughSequence: 2 });
    expect(setup.cursors.rows.find((cursor) => cursor.instrumentId === "NSE:RELIANCE")?.lastSeenSequence).toBe(0);
    expect(setup.cursors.rows.filter((cursor) => cursor.instrumentId !== "NSE:RELIANCE").every((cursor) => cursor.lastSeenSequence === 2)).toBe(true);
  });

  it("rejects acknowledgement beyond current market state", async () => {
    await expect(setup.service.acknowledge("demo-user", { instrumentIds: ["NSE:TCS"], throughSequence: 1 })).rejects.toMatchObject({ code: "INVALID_ACK_SEQUENCE" });
  });

  it("rejects acknowledgement for an instrument outside the active watchlist", async () => {
    await expect(setup.service.acknowledge("demo-user", { instrumentIds: ["NSE:NOT-WATCHED"], throughSequence: 0 })).rejects.toMatchObject({ code: "INSTRUMENT_NOT_WATCHED" });
  });

  it("never regresses a cursor under stale acknowledgement", async () => {
    await moveTo(setup.sessions, 2);
    await setup.service.acknowledge("demo-user", { instrumentIds: ["NSE:TCS"], throughSequence: 2 });
    const version = setup.cursors.rows.find((cursor) => cursor.instrumentId === "NSE:TCS")?.cursorVersion;
    await setup.service.acknowledge("demo-user", { instrumentIds: ["NSE:TCS"], throughSequence: 1 });
    const cursor = setup.cursors.rows.find((row) => row.instrumentId === "NSE:TCS");
    expect(cursor?.lastSeenSequence).toBe(2);
    expect(cursor?.cursorVersion).toBe(version);
    expect(setup.acknowledgements.rows).toHaveLength(1);
  });
});
