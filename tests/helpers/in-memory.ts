import type { InstrumentRecord } from "@/domain/instrument/types";
import type { WatchIntentRecord } from "@/domain/intent/types";
import type { DemoStateRecord, KnowledgeAcknowledgementRecord, KnowledgeCursorRecord, MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import type { WatchGraphDraft, WatchGraphRecord } from "@/domain/graph/types";
import type {
  CreateIntentRecordInput,
  DemoSessionRepository,
  InstrumentRepository,
  MarketEventRepository,
  MarketSnapshotRepository,
  WatchIntentRepository,
  WatchlistItemRecord,
  WatchlistRecord,
  WatchlistRepository,
  KnowledgeCursorRepository,
  CursorBaselineInput,
  CreateWatchGraphInput,
  KnowledgeAcknowledgementRepository,
  WatchGraphRepository,
} from "@/server/repositories/contracts";

export const testInstrument: InstrumentRecord = {
  id: "NSE:TCS", symbol: "TCS", exchange: "NSE", name: "Tata Consultancy Services", sector: "IT", currency: "INR", isActive: true,
};

export function intentRecord(input: Partial<WatchIntentRecord> = {}): WatchIntentRecord {
  const now = new Date("2025-08-14T04:30:00.000Z");
  return {
    id: "version-1", logicalIntentId: "logical-1", userId: "demo-user", instrumentId: "NSE:TCS", type: "EARNINGS",
    originalText: "Watching Q2 margins", structuredPayload: { focus: ["MARGINS"], quarterLabel: "Q2" },
    provenanceSource: "RESULTS_CALENDAR", provenanceReference: null, status: "ACTIVE", version: 1, supersedesId: null,
    effectiveFromSequence: 0, resolvedAt: null, resolvedAtSequence: null, lifecycleReviewedThroughSequence: null,
    horizon: null, expiresAt: null, createdAt: now, updatedAt: now, ...input,
  };
}

export class MemoryInstrumentRepository implements InstrumentRepository {
  constructor(public rows: InstrumentRecord[] = [testInstrument]) {}
  async listActive() { return this.rows.filter((row) => row.isActive); }
  async findById(id: string) { return this.rows.find((row) => row.id === id) ?? null; }
}

export class MemoryIntentRepository implements WatchIntentRepository {
  constructor(public rows: WatchIntentRecord[] = []) {}
  async listForInstrument(userId: string, instrumentId: string) { return this.rows.filter((row) => row.userId === userId && row.instrumentId === instrumentId); }
  async listActiveForInstruments(userId: string, instrumentIds: string[]) { return this.rows.filter((row) => row.userId === userId && instrumentIds.includes(row.instrumentId) && row.status === "ACTIVE"); }
  async findCurrent(userId: string, logicalIntentId: string) { return this.rows.find((row) => row.userId === userId && row.logicalIntentId === logicalIntentId && row.status === "ACTIVE") ?? null; }
  async findLatest(userId: string, logicalIntentId: string) { return this.rows.filter((row) => row.userId === userId && row.logicalIntentId === logicalIntentId).sort((a, b) => b.version - a.version)[0] ?? null; }
  async create(input: CreateIntentRecordInput) {
    const row = intentRecord({ ...input, status: "ACTIVE", createdAt: new Date(), updatedAt: new Date() });
    this.rows.push(row); return row;
  }
  async supersedeAndCreate(previousId: string, input: CreateIntentRecordInput) {
    const previous = this.rows.find((row) => row.id === previousId);
    if (!previous) throw new Error("missing previous intent");
    previous.status = "SUPERSEDED";
    return this.create(input);
  }
  async archiveCurrent(id: string) {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error("missing intent");
    row.status = "ARCHIVED"; return row;
  }
  async resolveCurrent(id: string, resolvedAt: Date, resolvedAtSequence: number) {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error("missing intent");
    Object.assign(row, { status: "RESOLVED" as const, resolvedAt, resolvedAtSequence, updatedAt: resolvedAt }); return row;
  }
  async keepWatching(id: string, throughSequence: number) {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error("missing intent");
    row.lifecycleReviewedThroughSequence = throughSequence; return row;
  }
  async renew(_previousId: string, input: CreateIntentRecordInput) { return this.create(input); }
}

export class MemoryDemoSessionRepository implements DemoSessionRepository {
  constructor(public state: DemoStateRecord = {
    id: "default-demo-session", scenarioId: "groww-delta-default", currentStep: 0, currentSequence: 0,
    currentTime: new Date("2025-08-14T04:30:00.000Z"),
  }) {}
  async getById(id: string) { return id === this.state.id ? { ...this.state } : null; }
  async setPosition(id: string, currentStep: number, currentSequence: number, currentTime: Date) {
    if (id !== this.state.id) throw new Error("missing session");
    this.state = { ...this.state, currentStep, currentSequence, currentTime }; return { ...this.state };
  }
}

export class MemorySnapshotRepository implements MarketSnapshotRepository {
  constructor(public rows: MarketSnapshotRecord[]) {}
  async findCurrent(instrumentId: string, sequence: number) { return this.rows.filter((row) => row.instrumentId === instrumentId && row.sequence <= sequence).sort((a, b) => b.sequence - a.sequence)[0] ?? null; }
  async findCurrentMany(ids: string[], sequence: number) {
    return (await Promise.all(ids.map((id) => this.findCurrent(id, sequence)))).filter((row): row is MarketSnapshotRecord => row !== null);
  }
  async listThroughSequence(instrumentId: string, sequence: number) { return this.rows.filter((row) => row.instrumentId === instrumentId && row.sequence <= sequence).sort((a, b) => a.sequence - b.sequence); }
  async listForInstrumentsThrough(instrumentIds: string[], sequence: number) { return this.rows.filter((row) => instrumentIds.includes(row.instrumentId) && row.sequence <= sequence).sort((a, b) => a.instrumentId.localeCompare(b.instrumentId) || a.sequence - b.sequence); }
}

export class MemoryEventRepository implements MarketEventRepository {
  constructor(public rows: MarketEventRecord[]) {}
  async listBetweenSequences(start: number, end: number) { return this.rows.filter((row) => row.sequence > start && row.sequence <= end); }
}

export class MemoryWatchlistRepository implements WatchlistRepository {
  constructor(public record: WatchlistRecord) {}
  async getDefaultForUser(userId: string) { return this.record.userId === userId ? { ...this.record, items: this.record.items.filter((item) => item.archivedAt === null) } : null; }
  async findActiveItem(watchlistId: string, instrumentId: string) { return this.record.items.find((item) => item.watchlistId === watchlistId && item.instrumentId === instrumentId && item.archivedAt === null) ?? null; }
  async addItem(watchlistId: string, instrumentId: string) {
    const instrument = testInstrument;
    const item: WatchlistItemRecord = { id: `item-${this.record.items.length + 1}`, watchlistId, instrumentId, addedAt: new Date(), archivedAt: null, provenanceSource: "MANUAL", provenanceReference: null, instrument };
    this.record.items.push(item); return item;
  }
  async archiveItem(itemId: string, watchlistId: string, archivedAt: Date) {
    const row = this.record.items.find((item) => item.id === itemId && item.watchlistId === watchlistId && item.archivedAt === null);
    if (!row) return false;
    row.archivedAt = archivedAt; return true;
  }
}

export function watchlistRecord(items: WatchlistItemRecord[] = []): WatchlistRecord {
  const now = new Date("2025-08-14T04:30:00.000Z");
  return { id: "demo-watchlist", userId: "demo-user", name: "My Watchlist", createdAt: now, updatedAt: now, items };
}

export function cursorRecord(input: Partial<KnowledgeCursorRecord> = {}): KnowledgeCursorRecord {
  const now = new Date("2025-08-14T04:30:00.000Z");
  return {
    id: "cursor-tcs", userId: "demo-user", instrumentId: "NSE:TCS", lastSeenSequence: 0,
    lastSeenEventTime: now, lastObservedSnapshotId: "snapshot:0:NSE:TCS", cursorVersion: 1,
    createdAt: now, updatedAt: now, ...input,
  };
}

export class MemoryKnowledgeCursorRepository implements KnowledgeCursorRepository {
  constructor(public rows: KnowledgeCursorRecord[] = []) {}

  async listForInstruments(userId: string, instrumentIds: string[]) {
    return this.rows.filter((row) => row.userId === userId && instrumentIds.includes(row.instrumentId)).map((row) => ({ ...row }));
  }

  async setBaseline(userId: string, input: CursorBaselineInput) {
    const existing = this.rows.find((row) => row.userId === userId && row.instrumentId === input.instrumentId);
    if (existing) {
      Object.assign(existing, { lastSeenSequence: input.sequence, lastSeenEventTime: input.eventTime, lastObservedSnapshotId: input.snapshotId, cursorVersion: existing.cursorVersion + 1, updatedAt: new Date() });
      return { ...existing };
    }
    const created = cursorRecord({ id: `cursor-${input.instrumentId}`, userId, instrumentId: input.instrumentId, lastSeenSequence: input.sequence, lastSeenEventTime: input.eventTime, lastObservedSnapshotId: input.snapshotId });
    this.rows.push(created);
    return { ...created };
  }

  async advanceMonotonic(userId: string, input: CursorBaselineInput) {
    const existing = this.rows.find((row) => row.userId === userId && row.instrumentId === input.instrumentId);
    if (!existing) return null;
    if (existing.lastSeenSequence < input.sequence) {
      Object.assign(existing, { lastSeenSequence: input.sequence, lastSeenEventTime: input.eventTime, lastObservedSnapshotId: input.snapshotId, cursorVersion: existing.cursorVersion + 1, updatedAt: new Date() });
    }
    return { ...existing };
  }

  async resetMany(userId: string, inputs: CursorBaselineInput[]) {
    return Promise.all(inputs.map((input) => this.setBaseline(userId, input)));
  }
}

export class MemoryKnowledgeAcknowledgementRepository implements KnowledgeAcknowledgementRepository {
  constructor(public rows: KnowledgeAcknowledgementRecord[] = []) {}
  async create(input: Parameters<KnowledgeAcknowledgementRepository["create"]>[0]) {
    const row: KnowledgeAcknowledgementRecord = { id: `ack-${this.rows.length + 1}`, ...input };
    this.rows.push(row); return row;
  }
  async listForInstrument(userId: string, instrumentId: string) { return this.rows.filter((row) => row.userId === userId && row.instrumentId === instrumentId); }
}

export class MemoryWatchGraphRepository implements WatchGraphRepository {
  constructor(public rows: WatchGraphRecord[] = []) {}
  async listActiveForIntentLogicalIds(userId: string, ids: string[]) { return this.rows.filter((row) => row.userId === userId && ids.includes(row.watchIntentLogicalId) && row.status === "ACTIVE"); }
  async listForIntent(userId: string, id: string) { return this.rows.filter((row) => row.userId === userId && row.watchIntentLogicalId === id).sort((a, b) => b.version - a.version); }
  async findActive(userId: string, id: string) { return this.rows.find((row) => row.userId === userId && row.watchIntentLogicalId === id && row.status === "ACTIVE") ?? null; }
  async createVersion(previousId: string | null, input: CreateWatchGraphInput) {
    const previous = this.rows.find((row) => row.id === previousId);
    if (previous?.status === "ACTIVE") previous.status = "SUPERSEDED";
    const now = new Date();
    const row: WatchGraphRecord = {
      ...input,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      nodes: input.nodes.map((node) => ({ ...node, graphId: input.id, metadata: node.metadata ?? {}, createdAt: now })),
      edges: input.edges.map((edge) => ({ id: edge.id, graphId: input.id, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId, relationship: edge.relationship, weight: edge.weight, createdAt: now })),
    };
    this.rows.push(row); return row;
  }
  async archiveActiveForIntent(userId: string, id: string) {
    const active = this.rows.filter((row) => row.userId === userId && row.watchIntentLogicalId === id && row.status === "ACTIVE");
    active.forEach((row) => { row.status = "ARCHIVED"; }); return active.length;
  }
}

export function graphRecord(
  draft: WatchGraphDraft,
  input: Partial<Omit<WatchGraphRecord, "nodes" | "edges">> = {},
): WatchGraphRecord {
  const now = new Date("2025-08-14T04:30:00.000Z");
  const id = input.id ?? "graph-version-1";
  const nodes = draft.nodes.map((node, index) => ({
    id: `${id}:node:${index}`,
    graphId: id,
    nodeKey: node.nodeKey,
    type: node.type,
    label: node.label,
    metadata: node.metadata ?? {},
    createdAt: now,
  }));
  const nodeIds = new Map(nodes.map((node) => [node.nodeKey, node.id]));
  return {
    id,
    logicalGraphId: "logical-graph-1",
    userId: "demo-user",
    instrumentId: "NSE:INDIGO",
    watchIntentLogicalId: "indigo-driver",
    version: 1,
    status: "ACTIVE",
    provenance: "IMPORTED_DEMO",
    templateKey: "AIRLINE_FUEL_COST",
    effectiveFromSequence: 0,
    supersedesId: null,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges: draft.edges.map((edge, index) => ({
      id: `${id}:edge:${index}`,
      graphId: id,
      fromNodeId: nodeIds.get(edge.fromKey) ?? edge.fromKey,
      toNodeId: nodeIds.get(edge.toKey) ?? edge.toKey,
      relationship: edge.relationship,
      weight: edge.weight,
      createdAt: now,
    })),
    ...input,
  };
}
