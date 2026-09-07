import type { INTENT_TYPES, PROVENANCE_SOURCES } from "@/lib/constants";

export type IntentType = (typeof INTENT_TYPES)[number];
export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];
export type IntentStatus = "ACTIVE" | "SUPERSEDED" | "RESOLVED" | "ARCHIVED";

export interface WatchIntentRecord {
  id: string;
  logicalIntentId: string;
  userId: string;
  instrumentId: string;
  type: IntentType;
  originalText: string | null;
  structuredPayload: unknown;
  provenanceSource: ProvenanceSource;
  provenanceReference: string | null;
  status: IntentStatus;
  version: number;
  effectiveFromSequence: number;
  resolvedAt: Date | null;
  resolvedAtSequence: number | null;
  lifecycleReviewedThroughSequence: number | null;
  supersedesId: string | null;
  horizon: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchIntentDraft {
  type: IntentType;
  originalText: string | null;
  structuredPayload: unknown;
  provenanceSource: ProvenanceSource;
  provenanceReference: string | null;
  horizon: string | null;
  expiresAt: Date | null;
}
