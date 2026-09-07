import type { InstrumentRecord } from "@/domain/instrument/types";
import type { IntentType, WatchIntentRecord } from "@/domain/intent/types";
import type { KnowledgeCursorRecord, MarketEventRecord, MarketQuality, MarketSnapshotRecord } from "@/domain/market/types";
import type { AttentionReasonCode } from "./reason-codes";
import type { GraphMatch, RelevancePathNode, WatchGraphRecord } from "@/domain/graph/types";

export type AttentionLane = "RELEVANT" | "SIGNIFICANT" | "QUIET";

export interface IntentMatch {
  matchType: "DIRECT" | "GRAPH";
  logicalIntentId: string;
  version: number;
  type: IntentType;
  originalText: string | null;
  reasonCode: AttentionReasonCode;
  urgency: number;
  relevance: number;
  eventIds: string[];
  transitionSnapshotIds: string[];
  metadata: Record<string, string | number>;
  graphMatch: GraphMatch | null;
}

export interface AttentionEventSummary {
  id: string;
  type: MarketEventRecord["type"];
  eventTime: Date;
  quality: MarketQuality;
  payload: unknown;
  subjectKey: string | null;
  tags: string[];
}

export interface AttentionDisplay {
  label: string;
  headline: string;
  whySeeing: string;
  additionalSignals: string[];
  matchType: "DIRECT" | "GRAPH" | null;
  watchReason: string | null;
  connectionPath: string[];
}

export interface AttentionItem {
  instrument: InstrumentRecord;
  fromSequence: number;
  toSequence: number;
  fromTime: Date;
  toTime: Date;
  baselineSnapshot: MarketSnapshotRecord;
  currentSnapshot: MarketSnapshotRecord;
  baselinePricePaise: number;
  currentPricePaise: number;
  priceDeltaPaise: number;
  priceDeltaBps: number;
  expectedWindowMoveBps: number | null;
  priceSurprise: number | null;
  volumeRatio: number | null;
  priceSignificance: number;
  volumeSignificance: number;
  eventSignificance: number;
  significance: number;
  relevance: number;
  novelty: number;
  urgency: number;
  confidence: number;
  score: number;
  lane: AttentionLane;
  matchedIntents: IntentMatch[];
  relevancePaths: RelevancePathNode[][];
  reasonCodes: AttentionReasonCode[];
  eventSummaries: AttentionEventSummary[];
  display: AttentionDisplay;
}

export interface AttentionAnalysisInput {
  instrument: InstrumentRecord;
  cursor: KnowledgeCursorRecord;
  currentSequence: number;
  currentTime: Date;
  snapshots: MarketSnapshotRecord[];
  events: MarketEventRecord[];
  activeIntents: WatchIntentRecord[];
  activeGraphs: WatchGraphRecord[];
}
