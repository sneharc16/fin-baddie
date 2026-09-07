import type { InstrumentRecord } from "@/domain/instrument/types";
import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import type { WatchIntentRecord } from "@/domain/intent/types";
import type { KnowledgeCursorRecord } from "@/domain/market/types";
import type { AttentionItem } from "@/domain/attention/types";
import type { WatchGraphRecord } from "@/domain/graph/types";
import type { IntentLifecycleResult } from "@/domain/intent/lifecycle";
import type { AttentionItemDto, InstrumentDto, IntentLifecycleDto, KnowledgeCursorDto, MarketEventDto, MarketSnapshotDto, WatchGraphDto, WatchIntentDto } from "./types";

export function toInstrumentDto(instrument: InstrumentRecord): InstrumentDto {
  return {
    id: instrument.id,
    symbol: instrument.symbol,
    exchange: instrument.exchange,
    name: instrument.name,
    sector: instrument.sector,
    currency: instrument.currency,
  };
}

export function toSnapshotDto(snapshot: MarketSnapshotRecord): MarketSnapshotDto {
  return {
    id: snapshot.id,
    instrumentId: snapshot.instrumentId,
    sequence: snapshot.sequence,
    eventTime: snapshot.eventTime.toISOString(),
    pricePaise: snapshot.pricePaise,
    openPaise: snapshot.openPaise,
    highPaise: snapshot.highPaise,
    lowPaise: snapshot.lowPaise,
    cumulativeVolume: Number(snapshot.cumulativeVolume),
    expectedCumulativeVolume: snapshot.expectedCumulativeVolume === null ? null : Number(snapshot.expectedCumulativeVolume),
    expectedStepMoveBps: snapshot.expectedStepMoveBps,
    source: snapshot.source,
    quality: snapshot.quality,
    dayChangePercent: ((snapshot.pricePaise - snapshot.openPaise) / snapshot.openPaise) * 100,
  };
}

export function toIntentDto(intent: WatchIntentRecord): WatchIntentDto {
  return {
    id: intent.id,
    logicalIntentId: intent.logicalIntentId,
    instrumentId: intent.instrumentId,
    type: intent.type,
    originalText: intent.originalText,
    structuredPayload: intent.structuredPayload,
    provenanceSource: intent.provenanceSource,
    provenanceReference: intent.provenanceReference,
    status: intent.status,
    version: intent.version,
    effectiveFromSequence: intent.effectiveFromSequence,
    resolvedAt: intent.resolvedAt?.toISOString() ?? null,
    resolvedAtSequence: intent.resolvedAtSequence,
    lifecycleReviewedThroughSequence: intent.lifecycleReviewedThroughSequence,
    supersedesId: intent.supersedesId,
    horizon: intent.horizon,
    expiresAt: intent.expiresAt?.toISOString() ?? null,
    createdAt: intent.createdAt.toISOString(),
    updatedAt: intent.updatedAt.toISOString(),
  };
}

export function toEventDto(event: MarketEventRecord): MarketEventDto {
  return {
    id: event.id,
    sequence: event.sequence,
    instrumentId: event.instrumentId,
    type: event.type,
    eventTime: event.eventTime.toISOString(),
    receivedTime: event.receivedTime.toISOString(),
    source: event.source,
    quality: event.quality,
    payload: event.payload,
    subjectType: event.subjectType,
    subjectKey: event.subjectKey,
    tags: event.tags,
    correctionOfId: event.correctionOfId,
  };
}

export function toCursorDto(cursor: KnowledgeCursorRecord): KnowledgeCursorDto {
  return {
    id: cursor.id,
    instrumentId: cursor.instrumentId,
    lastSeenSequence: cursor.lastSeenSequence,
    lastSeenEventTime: cursor.lastSeenEventTime?.toISOString() ?? null,
    lastObservedSnapshotId: cursor.lastObservedSnapshotId,
    cursorVersion: cursor.cursorVersion,
  };
}

export function toAttentionItemDto(item: AttentionItem): AttentionItemDto {
  return {
    instrument: toInstrumentDto(item.instrument),
    fromSequence: item.fromSequence,
    toSequence: item.toSequence,
    fromTime: item.fromTime.toISOString(),
    toTime: item.toTime.toISOString(),
    baselineSnapshot: toSnapshotDto(item.baselineSnapshot),
    currentSnapshot: toSnapshotDto(item.currentSnapshot),
    baselinePricePaise: item.baselinePricePaise,
    currentPricePaise: item.currentPricePaise,
    priceDeltaPaise: item.priceDeltaPaise,
    priceDeltaBps: item.priceDeltaBps,
    expectedWindowMoveBps: item.expectedWindowMoveBps,
    priceSurprise: item.priceSurprise,
    volumeRatio: item.volumeRatio,
    priceSignificance: item.priceSignificance,
    volumeSignificance: item.volumeSignificance,
    eventSignificance: item.eventSignificance,
    significance: item.significance,
    relevance: item.relevance,
    novelty: item.novelty,
    urgency: item.urgency,
    confidence: item.confidence,
    score: item.score,
    lane: item.lane,
    matchedIntents: item.matchedIntents.map((match) => ({
      ...match,
      graphMatch: match.graphMatch ? {
        matchType: match.graphMatch.matchType,
        graphId: match.graphMatch.graphId,
        graphVersion: match.graphMatch.graphVersion,
        logicalIntentId: match.graphMatch.logicalIntentId,
        eventId: match.graphMatch.eventId,
        eventSubjectKey: match.graphMatch.eventSubjectKey,
        matchedNodeKey: match.graphMatch.matchedNodeKey,
        relevance: match.graphMatch.relevance,
        pathDepth: match.graphMatch.pathDepth,
        pathWeight: match.graphMatch.pathWeight,
        effectiveSequence: match.graphMatch.effectiveSequence,
        path: match.graphMatch.path,
      } : null,
    })),
    relevancePaths: item.relevancePaths,
    reasonCodes: item.reasonCodes,
    eventSummaries: item.eventSummaries.map((event) => ({ ...event, eventTime: event.eventTime.toISOString() })),
    display: item.display,
  };
}

export function toWatchGraphDto(graph: WatchGraphRecord): WatchGraphDto {
  const root = graph.nodes.find((node) => node.type === "INSTRUMENT");
  if (!root) throw new Error("A graph DTO requires an instrument root.");
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    id: graph.id,
    logicalGraphId: graph.logicalGraphId,
    watchIntentLogicalId: graph.watchIntentLogicalId,
    version: graph.version,
    status: graph.status,
    provenance: graph.provenance,
    templateKey: graph.templateKey,
    effectiveFromSequence: graph.effectiveFromSequence,
    root: { key: root.nodeKey, label: root.label, type: root.type },
    relatedDrivers: graph.nodes.filter((node) => node.type !== "INSTRUMENT" && node.type !== "QUESTION").map((node) => ({ key: node.nodeKey, label: node.label, type: node.type })),
    connections: graph.edges.flatMap((edge) => {
      const from = nodeById.get(edge.fromNodeId);
      const to = nodeById.get(edge.toNodeId);
      return from && to ? [{ fromKey: from.nodeKey, toKey: to.nodeKey, label: "Configured relationship" }] : [];
    }),
    createdAt: graph.createdAt.toISOString(),
  };
}

export function toIntentLifecycleDto(value: IntentLifecycleResult): IntentLifecycleDto {
  return { ...value, triggerTime: value.triggerTime?.toISOString() ?? null };
}
