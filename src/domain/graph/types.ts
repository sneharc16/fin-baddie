import type { MarketEventRecord } from "@/domain/market/types";
import type { IntentType } from "@/domain/intent/types";

export const GRAPH_NODE_TYPES = ["INSTRUMENT", "QUESTION", "METRIC", "DRIVER", "EXTERNAL_DRIVER", "EVENT_CATEGORY", "PRICE_CONDITION"] as const;
export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number];
export const GRAPH_RELATIONSHIPS = ["WATCHES", "RELATES_TO", "MEASURED_BY", "AFFECTED_BY", "TRIGGERED_BY", "CONTEXT_FOR"] as const;
export type GraphRelationship = (typeof GRAPH_RELATIONSHIPS)[number];
export type GraphStatus = "ACTIVE" | "SUPERSEDED" | "ARCHIVED";
export type GraphProvenance = "MANUAL" | "CURATED_TEMPLATE" | "IMPORTED_DEMO";

export interface WatchGraphNodeRecord {
  id: string;
  graphId: string;
  nodeKey: string;
  type: GraphNodeType;
  label: string;
  metadata: unknown;
  createdAt: Date;
}

export interface WatchGraphEdgeRecord {
  id: string;
  graphId: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: GraphRelationship;
  weight: number;
  createdAt: Date;
}

export interface WatchGraphRecord {
  id: string;
  logicalGraphId: string;
  userId: string;
  instrumentId: string;
  watchIntentLogicalId: string;
  version: number;
  status: GraphStatus;
  provenance: GraphProvenance;
  templateKey: string | null;
  effectiveFromSequence: number;
  supersedesId: string | null;
  createdAt: Date;
  updatedAt: Date;
  nodes: WatchGraphNodeRecord[];
  edges: WatchGraphEdgeRecord[];
}

export interface GraphNodeDraft {
  nodeKey: string;
  type: GraphNodeType;
  label: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface GraphEdgeDraft {
  fromKey: string;
  toKey: string;
  relationship: GraphRelationship;
  weight: number;
}

export interface WatchGraphDraft {
  nodes: GraphNodeDraft[];
  edges: GraphEdgeDraft[];
}

export interface RelevancePathNode {
  type: GraphNodeType;
  key: string;
  label: string;
}

export interface GraphMatch {
  matchType: "GRAPH";
  graphId: string;
  graphVersion: number;
  logicalIntentId: string;
  eventId: string;
  eventSubjectKey: string;
  matchedNodeKey: string;
  relevance: number;
  pathDepth: number;
  pathWeight: number;
  effectiveSequence: number;
  path: RelevancePathNode[];
  event: MarketEventRecord;
}

export interface DriverSuggestion {
  key: string;
  label: string;
  type: GraphNodeType;
  description: string;
  selectedByDefault: boolean;
}

export interface DriverTemplate {
  key: string;
  label: string;
  description: string;
  applicableInstrumentIds: string[];
  applicableIntentTypes: IntentType[];
  nodes: Array<GraphNodeDraft & { selectable?: boolean; description?: string; selectedByDefault?: boolean; alwaysInclude?: boolean }>;
  edges: GraphEdgeDraft[];
}
