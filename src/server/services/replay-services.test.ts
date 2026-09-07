import { beforeEach, describe, expect, it } from "vitest";
import { defaultReplayScenario } from "../../../data/replay/default-scenario";
import { DemoMarketService } from "./demo-market-service";
import { ReplayMarketProvider } from "@/server/market/providers/replay-market-provider";
import { MemoryDemoSessionRepository, MemoryEventRepository, MemoryKnowledgeCursorRepository, MemorySnapshotRepository, MemoryWatchlistRepository, cursorRecord, intentRecord, testInstrument, watchlistRecord } from "../../../tests/helpers/in-memory";
import type { WatchlistItemRecord } from "@/server/repositories/contracts";
import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";

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
  eventTime: new Date(event.eventTime),
  receivedTime: new Date(event.eventTime),
  source: "ReplayMarketProvider",
  quality: "FRESH",
  correctionOfId: null,
}));

describe("deterministic replay", () => {
  let sessions: MemoryDemoSessionRepository;
  let service: DemoMarketService;
  let provider: ReplayMarketProvider;
  let cursors: MemoryKnowledgeCursorRepository;
  let intents: ReturnType<typeof intentRecord>[];

  beforeEach(() => {
    sessions = new MemoryDemoSessionRepository();
    provider = new ReplayMarketProvider(sessions, new MemorySnapshotRepository(snapshots), new MemoryEventRepository(events));
    const item: WatchlistItemRecord = { id: "item-tcs", watchlistId: "demo-watchlist", instrumentId: "NSE:TCS", addedAt: new Date(), archivedAt: null, provenanceSource: "IMPORTED_DEMO", provenanceReference: null, instrument: testInstrument };
    cursors = new MemoryKnowledgeCursorRepository([cursorRecord()]);
    intents = [intentRecord()];
    service = new DemoMarketService(provider, new MemoryWatchlistRepository(watchlistRecord([item])), cursors, provider);
  });

  it("returns the exact Step 0 snapshot", async () => {
    const snapshot = await provider.getCurrentSnapshot("NSE:TCS");
    expect(snapshot?.sequence).toBe(0);
    expect(snapshot?.pricePaise).toBe(320000);
  });

  it("advances one deterministic step and persists it", async () => {
    await service.advance();
    expect((await service.getState()).currentStep).toBe(1);
    expect((await provider.getCurrentSnapshot("NSE:TCS"))?.pricePaise).toBe(320600);
    expect((await new DemoMarketService(provider, new MemoryWatchlistRepository(watchlistRecord()), new MemoryKnowledgeCursorRepository(), provider).getState()).currentStep).toBe(1);
  });

  it("does not advance beyond the final replay step", async () => {
    await service.advance(); await service.advance(); await service.advance(); await service.advance();
    const result = await service.advance();
    expect(result.advanced).toBe(false);
    expect(result.currentStep).toBe(4);
    expect(result.message).toContain("final step");
  });

  it("resets exactly to Step 0", async () => {
    await service.advance(); await service.advance();
    await cursors.advanceMonotonic("demo-user", { instrumentId: "NSE:TCS", sequence: 2, eventTime: new Date(defaultReplayScenario.steps[2].eventTime), snapshotId: "snapshot:2:NSE:TCS" });
    const intentHistory = structuredClone(intents);
    const reset = await service.reset("demo-user");
    expect(reset.currentStep).toBe(0);
    expect(reset.currentSequence).toBe(0);
    expect(reset.currentTime).toBe(new Date(defaultReplayScenario.steps[0].eventTime).toISOString());
    expect(cursors.rows[0]).toMatchObject({ lastSeenSequence: 0, lastObservedSnapshotId: "snapshot:0:NSE:TCS" });
    expect(intents).toEqual(intentHistory);
  });

  it("returns only deterministic events after the requested sequence and through the current position", async () => {
    await service.advance(); await service.advance();
    const occurred = await provider.getEventsSince(0);
    expect(occurred.map((event) => event.id)).toEqual([
      "event:2:tcs:results", "event:2:tatamotors:breakout", "event:2:indigo:fuel-cost",
    ]);
    expect(await provider.getEventsSince(2)).toEqual([]);
  });
});
