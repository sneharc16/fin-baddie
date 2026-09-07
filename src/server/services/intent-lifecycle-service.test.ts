import { beforeEach, describe, expect, it } from "vitest";
import { defaultReplayScenario } from "../../../data/replay/default-scenario";
import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import { findDriverTemplate, graphDraftFromTemplate } from "@/domain/graph/templates";
import { ReplayMarketProvider } from "@/server/market/providers/replay-market-provider";
import {
  MemoryDemoSessionRepository,
  MemoryEventRepository,
  MemoryIntentRepository,
  MemoryKnowledgeAcknowledgementRepository,
  MemoryKnowledgeCursorRepository,
  MemorySnapshotRepository,
  MemoryWatchGraphRepository,
  cursorRecord,
  graphRecord,
  intentRecord,
} from "../../../tests/helpers/in-memory";
import { IntentLifecycleService } from "./intent-lifecycle-service";

const snapshots: MarketSnapshotRecord[] = defaultReplayScenario.steps.flatMap((step) => step.snapshots.map((snapshot) => ({ id: `snapshot:${step.sequence}:${snapshot.instrumentId}`, ...snapshot, sequence: step.sequence, eventTime: new Date(step.eventTime), source: "ReplayMarketProvider", quality: "FRESH" as const })));
const events: MarketEventRecord[] = defaultReplayScenario.events.map((event) => ({ ...event, eventTime: new Date(event.eventTime), receivedTime: new Date(event.eventTime), source: "ReplayMarketProvider", quality: "FRESH", correctionOfId: null }));

describe("IntentLifecycleService", () => {
  let intents: MemoryIntentRepository;
  let graphs: MemoryWatchGraphRepository;
  let acknowledgements: MemoryKnowledgeAcknowledgementRepository;
  let service: IntentLifecycleService;

  beforeEach(() => {
    const first = intentRecord({ id: "tcs-v1", logicalIntentId: "tcs-results" });
    const second = intentRecord({ id: "tcs-long", logicalIntentId: "tcs-long-term", type: "LONG_TERM", originalText: "Watching long term", structuredPayload: { note: "Long-term context" } });
    intents = new MemoryIntentRepository([first, second]);
    const draft = graphDraftFromTemplate(findDriverTemplate("IT_SERVICES_MARGINS", "NSE:TCS"), ["OPERATING_MARGIN", "EARNINGS"]);
    graphs = new MemoryWatchGraphRepository([graphRecord(draft, { id: "tcs-graph-v1", instrumentId: "NSE:TCS", watchIntentLogicalId: "tcs-results", templateKey: "IT_SERVICES_MARGINS" })]);
    acknowledgements = new MemoryKnowledgeAcknowledgementRepository([{ id: "ack-tcs-1", userId: "demo-user", instrumentId: "NSE:TCS", fromSequence: 0, throughSequence: 2, scope: "INSTRUMENT", acknowledgedAt: new Date() }]);
    const sessions = new MemoryDemoSessionRepository({ id: "default-demo-session", scenarioId: "groww-delta-default", currentStep: 2, currentSequence: 2, currentTime: new Date(defaultReplayScenario.steps[2].eventTime) });
    const market = new ReplayMarketProvider(sessions, new MemorySnapshotRepository(snapshots), new MemoryEventRepository(events));
    service = new IntentLifecycleService(intents, graphs, new MemoryKnowledgeCursorRepository([cursorRecord({ lastSeenSequence: 2 })]), acknowledgements, sessions, market);
  });

  it("resolves one intent, preserves its history, archives its graph, and leaves other reasons active", async () => {
    const resolved = await service.resolve("demo-user", "tcs-results");
    expect(resolved.status).toBe("RESOLVED");
    expect(intents.rows.find((intent) => intent.id === "tcs-v1")?.status).toBe("RESOLVED");
    expect(intents.rows.find((intent) => intent.id === "tcs-long")?.status).toBe("ACTIVE");
    expect(graphs.rows[0].status).toBe("ARCHIVED");
  });

  it("renews resolved earnings as the next version and next quarter", async () => {
    await service.resolve("demo-user", "tcs-results");
    const result = await service.renew("demo-user", "tcs-results", {});
    expect(result.intent).toMatchObject({ status: "ACTIVE", version: 2, effectiveFromSequence: 2, supersedesId: "tcs-v1" });
    expect(result.summary).toContain("Q3");
    expect(intents.rows.filter((intent) => intent.logicalIntentId === "tcs-results")).toHaveLength(2);
    expect(graphs.rows.find((graph) => graph.version === 2)?.status).toBe("ACTIVE");
    expect((await service.getInstrument("demo-user", "NSE:TCS")).timeline).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Quarterly results published" })]));
  });

  it("derives a timeline from intent, event, acknowledgement, graph, and resolution state", async () => {
    await service.resolve("demo-user", "tcs-results");
    const result = await service.getInstrument("demo-user", "NSE:TCS");
    expect(result.timeline.map((entry) => entry.kind)).toEqual(expect.arrayContaining(["INTENT_STARTED", "GRAPH_CHANGED", "MARKET_EVENT", "ACKNOWLEDGED", "RESOLVED"]));
    expect(result.lifecycle.find((item) => item.logicalIntentId === "tcs-results")?.state).toBe("RESOLVED");
  });

  it("keeps an eligible reason active when the user chooses to keep watching", async () => {
    await service.keepWatching("demo-user", "tcs-results");
    const result = await service.getInstrument("demo-user", "NSE:TCS");
    expect(result.lifecycle.find((item) => item.logicalIntentId === "tcs-results")?.state).toBe("ACTIVE");
  });
});
