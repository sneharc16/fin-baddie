export type MarketQuality = "FRESH" | "DELAYED" | "STALE" | "CONFLICTING" | "CORRECTED";
export type MarketEventType = "QUOTE_UPDATE" | "RESULTS_PUBLISHED" | "TECHNICAL_TRANSITION" | "CORPORATE_EVENT" | "EXTERNAL_DRIVER" | "NEWS_EVENT";
export type EventSubjectType = "INSTRUMENT" | "METRIC" | "DRIVER" | "EXTERNAL_DRIVER" | "EVENT_CATEGORY" | "PRICE_CONDITION";

export interface MarketSnapshotRecord {
  id: string;
  instrumentId: string;
  sequence: number;
  eventTime: Date;
  pricePaise: number;
  openPaise: number;
  highPaise: number;
  lowPaise: number;
  cumulativeVolume: bigint;
  expectedCumulativeVolume: bigint | null;
  expectedStepMoveBps: number | null;
  source: string;
  quality: MarketQuality;
}

export interface MarketEventRecord {
  id: string;
  sequence: number;
  instrumentId: string | null;
  type: MarketEventType;
  eventTime: Date;
  receivedTime: Date;
  source: string;
  quality: MarketQuality;
  payload: unknown;
  subjectType: EventSubjectType | null;
  subjectKey: string | null;
  tags: string[];
  correctionOfId: string | null;
}

export interface DemoStateRecord {
  id: string;
  scenarioId: string;
  currentStep: number;
  currentSequence: number;
  currentTime: Date;
}

export interface KnowledgeCursorRecord {
  id: string;
  userId: string;
  instrumentId: string;
  lastSeenSequence: number;
  lastSeenEventTime: Date | null;
  lastObservedSnapshotId: string | null;
  cursorVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeAcknowledgementRecord {
  id: string;
  userId: string;
  instrumentId: string;
  fromSequence: number;
  throughSequence: number;
  scope: "INSTRUMENT" | "WATCHLIST";
  acknowledgedAt: Date;
}
