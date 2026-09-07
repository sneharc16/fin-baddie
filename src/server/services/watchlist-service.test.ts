import { describe, expect, it } from "vitest";
import { WatchlistService } from "./watchlist-service";
import { ReplayMarketProvider } from "@/server/market/providers/replay-market-provider";
import {
  MemoryDemoSessionRepository, MemoryEventRepository, MemoryInstrumentRepository, MemoryIntentRepository,
  MemorySnapshotRepository, MemoryWatchlistRepository, testInstrument, watchlistRecord,
  MemoryKnowledgeCursorRepository,
  cursorRecord,
} from "../../../tests/helpers/in-memory";
import type { WatchlistItemRecord } from "@/server/repositories/contracts";
import type { MarketSnapshotRecord } from "@/domain/market/types";

const item: WatchlistItemRecord = {
  id: "item-1", watchlistId: "demo-watchlist", instrumentId: "NSE:TCS", addedAt: new Date(), archivedAt: null,
  provenanceSource: "IMPORTED_DEMO", provenanceReference: "groww-delta-default", instrument: testInstrument,
};
const snapshot: MarketSnapshotRecord = {
  id: "snapshot:0:NSE:TCS", instrumentId: "NSE:TCS", sequence: 0, eventTime: new Date(), pricePaise: 320000,
  openPaise: 319500, highPaise: 320400, lowPaise: 319000, cumulativeVolume: 540000n, expectedCumulativeVolume: 560000n,
  source: "ReplayMarketProvider", quality: "FRESH",
  expectedStepMoveBps: 35,
};
const snapshotAtTwo: MarketSnapshotRecord = { ...snapshot, id: "snapshot:2:NSE:TCS", sequence: 2, eventTime: new Date("2025-08-14T05:30:00.000Z"), pricePaise: 321200 };

function setup(items: WatchlistItemRecord[], currentStep = 0, cursorRows = [cursorRecord()]) {
  const watchlists = new MemoryWatchlistRepository(watchlistRecord(items));
  const step = currentStep === 2
    ? { id: "default-demo-session", scenarioId: "groww-delta-default", currentStep: 2, currentSequence: 2, currentTime: snapshotAtTwo.eventTime }
    : undefined;
  const sessions = new MemoryDemoSessionRepository(step);
  const market = new ReplayMarketProvider(sessions, new MemorySnapshotRepository([snapshot, snapshotAtTwo]), new MemoryEventRepository([]));
  const cursors = new MemoryKnowledgeCursorRepository(cursorRows);
  return { watchlists, cursors, sessions, service: new WatchlistService(watchlists, new MemoryInstrumentRepository(), new MemoryIntentRepository(), market, cursors) };
}

describe("WatchlistService", () => {
  it("rejects duplicate active additions", async () => {
    const { service } = setup([{ ...item }]);
    await expect(service.add("demo-user", "NSE:TCS")).rejects.toMatchObject({ code: "DUPLICATE_WATCHLIST_ITEM" });
  });

  it("archives removal and permits re-adding the instrument", async () => {
    const { service, watchlists } = setup([{ ...item }]);
    await expect(service.remove("demo-user", "item-1")).resolves.toEqual({ id: "item-1", archived: true });
    expect(watchlists.record.items[0].archivedAt).toBeInstanceOf(Date);
    await expect(service.add("demo-user", "NSE:TCS")).resolves.toMatchObject({ instrument: { id: "NSE:TCS" } });
    expect(watchlists.record.items.filter((row) => row.archivedAt === null)).toHaveLength(1);
  });

  it("returns the current replay price in the watchlist DTO", async () => {
    const { service } = setup([{ ...item }]);
    const result = await service.getDefault("demo-user");
    expect(result.items[0].snapshot?.pricePaise).toBe(320000);
    expect(result.items[0].snapshot?.source).toBe("ReplayMarketProvider");
  });

  it("baselines a newly-added stock at the current sequence", async () => {
    const { service, cursors } = setup([], 2, []);
    await service.add("demo-user", "NSE:TCS");
    expect(cursors.rows[0]).toMatchObject({ lastSeenSequence: 2, lastObservedSnapshotId: "snapshot:2:NSE:TCS" });
  });

  it("re-baselines an archived stock at the current sequence", async () => {
    const { service, cursors } = setup([{ ...item, archivedAt: new Date() }], 2, [cursorRecord()]);
    await service.add("demo-user", "NSE:TCS");
    expect(cursors.rows[0]).toMatchObject({ lastSeenSequence: 2, lastObservedSnapshotId: "snapshot:2:NSE:TCS" });
  });
});
