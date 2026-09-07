import type { WatchGraphRecord } from "@/domain/graph/types";
import type { KnowledgeAcknowledgementRecord, MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import { matchIntents } from "@/domain/attention/intent-matchers";
import { matchGraphEvents } from "@/domain/graph/traversal";
import { summarizeIntent } from "./summary";
import type { WatchIntentRecord } from "./types";

export interface WatchTimelineEntry {
  id: string;
  kind: "INTENT_STARTED" | "INTENT_CHANGED" | "MARKET_EVENT" | "ACKNOWLEDGED" | "RESOLVED" | "GRAPH_CHANGED";
  sequence: number | null;
  occurredAt: Date;
  title: string;
  detail: string | null;
}

function timeAt(sequence: number, snapshots: MarketSnapshotRecord[], fallback: Date): Date {
  return snapshots.filter((snapshot) => snapshot.sequence <= sequence).sort((a, b) => b.sequence - a.sequence)[0]?.eventTime ?? fallback;
}

export function buildWatchTimeline(input: {
  intents: WatchIntentRecord[];
  graphs: WatchGraphRecord[];
  acknowledgements: KnowledgeAcknowledgementRecord[];
  snapshots: MarketSnapshotRecord[];
  events: MarketEventRecord[];
  currentSequence: number;
}): WatchTimelineEntry[] {
  const entries: WatchTimelineEntry[] = [];
  const recordedEventIds = new Set<string>();
  for (const intent of input.intents) {
    entries.push({
      id: `intent:${intent.id}`,
      kind: intent.version === 1 ? "INTENT_STARTED" : "INTENT_CHANGED",
      sequence: intent.effectiveFromSequence,
      occurredAt: timeAt(intent.effectiveFromSequence, input.snapshots, intent.createdAt),
      title: intent.version === 1 ? `Started ${summarizeIntent(intent)}` : `Watch reason changed to ${summarizeIntent(intent)}`,
      detail: `Version ${intent.version}`,
    });
    const nextVersion = input.intents.find((candidate) => candidate.supersedesId === intent.id);
    const versionEndSequence = nextVersion
      ? Math.min(input.currentSequence, nextVersion.effectiveFromSequence)
      : input.currentSequence;
    const versionEvents = input.events.filter((event) => event.sequence <= versionEndSequence);
    const versionSnapshots = input.snapshots.filter((snapshot) => snapshot.sequence <= versionEndSequence);
    const match = matchIntents({ intents: [intent], snapshots: versionSnapshots, events: versionEvents, cursorSequence: 0, currentSequence: versionEndSequence })[0];
    const event = match ? versionEvents.find((candidate) => match.eventIds.includes(candidate.id)) : null;
    const transition = match ? versionSnapshots.find((candidate) => match.transitionSnapshotIds.includes(candidate.id) && candidate.sequence > intent.effectiveFromSequence) : null;
    if (event) {
      entries.push({ id: `event:${intent.logicalIntentId}:${event.id}`, kind: "MARKET_EVENT", sequence: event.sequence, occurredAt: event.eventTime, title: event.type === "RESULTS_PUBLISHED" ? "Quarterly results published" : "Saved watch event occurred", detail: summarizeIntent(intent) });
      recordedEventIds.add(event.id);
    }
    else if (transition) entries.push({ id: `transition:${intent.logicalIntentId}:${transition.id}`, kind: "MARKET_EVENT", sequence: transition.sequence, occurredAt: transition.eventTime, title: intent.type === "PRICE_LEVEL" ? "Saved price condition reached" : "Saved technical condition triggered", detail: summarizeIntent(intent) });
    if (intent.resolvedAt) entries.push({ id: `resolved:${intent.id}`, kind: "RESOLVED", sequence: intent.resolvedAtSequence, occurredAt: timeAt(intent.resolvedAtSequence ?? input.currentSequence, input.snapshots, intent.resolvedAt), title: "Watch reason resolved", detail: summarizeIntent(intent) });
  }
  for (const acknowledgement of input.acknowledgements) {
    entries.push({ id: `ack:${acknowledgement.id}`, kind: "ACKNOWLEDGED", sequence: acknowledgement.throughSequence, occurredAt: timeAt(acknowledgement.throughSequence, input.snapshots, acknowledgement.acknowledgedAt), title: "Update marked seen", detail: acknowledgement.scope === "WATCHLIST" ? "Marked through the watchlist Catch Up" : "Marked for this stock" });
  }
  for (const graph of input.graphs) {
    entries.push({ id: `graph:${graph.id}`, kind: "GRAPH_CHANGED", sequence: graph.effectiveFromSequence, occurredAt: timeAt(graph.effectiveFromSequence, input.snapshots, graph.createdAt), title: graph.version === 1 ? "Related things added" : "Related things updated", detail: `Graph version ${graph.version}` });
    const intent = input.intents
      .filter((candidate) => candidate.logicalIntentId === graph.watchIntentLogicalId && candidate.effectiveFromSequence <= graph.effectiveFromSequence)
      .sort((a, b) => b.version - a.version)[0];
    const nextGraph = input.graphs.find((candidate) => candidate.supersedesId === graph.id);
    const versionEndSequence = nextGraph ? Math.min(input.currentSequence, nextGraph.effectiveFromSequence) : input.currentSequence;
    if (!intent || versionEndSequence <= graph.effectiveFromSequence) continue;
    const graphMatches = matchGraphEvents({
      graph: { ...graph, status: "ACTIVE" },
      intent,
      events: input.events.filter((event) => event.sequence <= versionEndSequence),
      cursorSequence: 0,
      currentSequence: versionEndSequence,
    });
    for (const match of graphMatches) {
      if (recordedEventIds.has(match.eventId)) continue;
      const subject = match.path.at(-1)?.label ?? match.eventSubjectKey;
      entries.push({ id: `graph-event:${graph.id}:${match.eventId}`, kind: "MARKET_EVENT", sequence: match.event.sequence, occurredAt: match.event.eventTime, title: `${subject} related-driver update`, detail: match.path.map((node) => node.label).join(" → ") });
      recordedEventIds.add(match.eventId);
    }
  }
  const unique = [...new Map(entries.map((entry) => [entry.id, entry])).values()];
  const rank: Record<WatchTimelineEntry["kind"], number> = { INTENT_STARTED: 0, INTENT_CHANGED: 0, GRAPH_CHANGED: 1, MARKET_EVENT: 2, ACKNOWLEDGED: 3, RESOLVED: 4 };
  return unique.sort((a, b) => (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER) || rank[a.kind] - rank[b.kind] || a.id.localeCompare(b.id));
}
