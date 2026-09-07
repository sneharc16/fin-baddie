import { beforeEach, describe, expect, it } from "vitest";
import { defaultReplayScenario } from "../../../data/replay/default-scenario";
import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import { ReplayMarketProvider } from "@/server/market/providers/replay-market-provider";
import { MemoryDemoSessionRepository, MemoryEventRepository, MemoryIntentRepository, MemorySnapshotRepository, MemoryWatchGraphRepository, intentRecord } from "../../../tests/helpers/in-memory";
import { WatchGraphService } from "./watch-graph-service";

const snapshots: MarketSnapshotRecord[] = defaultReplayScenario.steps.flatMap((step) => step.snapshots.map((snapshot) => ({ id: `snapshot:${step.sequence}:${snapshot.instrumentId}`, ...snapshot, sequence: step.sequence, eventTime: new Date(step.eventTime), source: "ReplayMarketProvider", quality: "FRESH" as const })));
const events: MarketEventRecord[] = defaultReplayScenario.events.map((event) => ({ ...event, eventTime: new Date(event.eventTime), receivedTime: new Date(event.eventTime), source: "ReplayMarketProvider", quality: "FRESH", correctionOfId: null }));

describe("WatchGraphService", () => {
  let graphs: MemoryWatchGraphRepository;
  let service: WatchGraphService;
  let sessions: MemoryDemoSessionRepository;

  beforeEach(() => {
    graphs = new MemoryWatchGraphRepository();
    sessions = new MemoryDemoSessionRepository();
    const market = new ReplayMarketProvider(sessions, new MemorySnapshotRepository(snapshots), new MemoryEventRepository(events));
    service = new WatchGraphService(graphs, new MemoryIntentRepository([intentRecord({ logicalIntentId: "indigo-driver", instrumentId: "NSE:INDIGO", type: "DRIVER", structuredPayload: { driverKey: "FUEL_COST", description: "Fuel" } })]), market);
  });

  it("returns curated suggestions without silently creating a graph", async () => {
    const suggestions = await service.suggestions("demo-user", "indigo-driver");
    expect(suggestions[0].nodes.map((node) => node.key)).toEqual(["FUEL_COST", "CRUDE", "USDINR"]);
    expect(graphs.rows).toEqual([]);
  });

  it("creates a user-confirmed graph at the current market sequence", async () => {
    await sessions.setPosition("default-demo-session", 2, 2, new Date(defaultReplayScenario.steps[2].eventTime));
    const created = await service.create("demo-user", "indigo-driver", { templateKey: "AIRLINE_FUEL_COST", selectedNodeKeys: ["FUEL_COST", "CRUDE"] });
    expect(created).toMatchObject({ version: 1, effectiveFromSequence: 2, provenance: "CURATED_TEMPLATE" });
    expect(created.relatedDrivers.map((node) => node.key)).toEqual(["FUEL_COST", "CRUDE"]);
  });

  it("edits by superseding an immutable historical graph version", async () => {
    const first = await service.create("demo-user", "indigo-driver", { templateKey: "AIRLINE_FUEL_COST", selectedNodeKeys: ["FUEL_COST", "CRUDE"] });
    await sessions.setPosition("default-demo-session", 3, 3, new Date(defaultReplayScenario.steps[3].eventTime));
    const second = await service.edit("demo-user", "indigo-driver", { templateKey: "AIRLINE_FUEL_COST", selectedNodeKeys: ["FUEL_COST"] });
    const history = await service.get("demo-user", "indigo-driver");
    expect(second).toMatchObject({ version: 2, effectiveFromSequence: 3 });
    expect(history.current?.relatedDrivers.map((node) => node.key)).toEqual(["FUEL_COST"]);
    expect(history.history).toHaveLength(2);
    expect(history.history.find((version) => version.id === first.id)?.status).toBe("SUPERSEDED");
  });

  it("rejects nodes outside the curated template", async () => {
    await expect(service.create("demo-user", "indigo-driver", { templateKey: "AIRLINE_FUEL_COST", selectedNodeKeys: ["INVENTED_DRIVER"] })).rejects.toMatchObject({ code: "INVALID_GRAPH_NODE_SELECTION" });
    expect(graphs.rows).toEqual([]);
  });
});
