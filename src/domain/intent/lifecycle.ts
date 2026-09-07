import type { KnowledgeCursorRecord, MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import type { WatchIntentRecord } from "./types";
import { matchIntents } from "@/domain/attention/intent-matchers";

export type IntentLifecycleState = "ACTIVE" | "RESOLUTION_ELIGIBLE" | "STALE_CANDIDATE" | "RESOLVED" | "ARCHIVED";
export const STALE_AFTER_ACK_MS = 60 * 60 * 1000;

export interface IntentLifecycleResult {
  logicalIntentId: string;
  instrumentId: string;
  type: WatchIntentRecord["type"];
  originalText: string | null;
  state: IntentLifecycleState;
  triggerSequence: number | null;
  triggerTime: Date | null;
  reason: string | null;
  actions: string[];
}

const resolvableTypes = new Set<WatchIntentRecord["type"]>(["PRICE_LEVEL", "EARNINGS", "DIVIDEND", "COMPANY_EVENT", "TECHNICAL"]);

export function evaluateIntentLifecycle(input: {
  intent: WatchIntentRecord;
  cursor: KnowledgeCursorRecord;
  snapshots: MarketSnapshotRecord[];
  events: MarketEventRecord[];
  currentSequence: number;
  currentTime: Date;
}): IntentLifecycleResult {
  const { intent } = input;
  const base = { logicalIntentId: intent.logicalIntentId, instrumentId: intent.instrumentId, type: intent.type, originalText: intent.originalText };
  if (intent.status === "RESOLVED") return { ...base, state: "RESOLVED", triggerSequence: intent.resolvedAtSequence, triggerTime: intent.resolvedAt, reason: "This watch reason was marked resolved.", actions: [] };
  if (intent.status === "ARCHIVED" || intent.status === "SUPERSEDED") return { ...base, state: "ARCHIVED", triggerSequence: null, triggerTime: null, reason: null, actions: [] };
  if (intent.expiresAt && intent.expiresAt.getTime() <= input.currentTime.getTime()) {
    return { ...base, state: "STALE_CANDIDATE", triggerSequence: null, triggerTime: intent.expiresAt, reason: "This watch reason has passed its saved expiry.", actions: ["CHANGE", "RESOLVE", "KEEP"] };
  }
  if (!resolvableTypes.has(intent.type)) return { ...base, state: "ACTIVE", triggerSequence: null, triggerTime: null, reason: null, actions: [] };

  const lifecycleFloor = intent.lifecycleReviewedThroughSequence ?? 0;
  const matches = matchIntents({ intents: [intent], snapshots: input.snapshots, events: input.events, cursorSequence: lifecycleFloor, currentSequence: input.currentSequence });
  const match = matches[0];
  if (!match) return { ...base, state: "ACTIVE", triggerSequence: null, triggerTime: null, reason: null, actions: [] };
  const event = input.events.find((candidate) => match.eventIds.includes(candidate.id));
  const transition = input.snapshots.find((candidate) => match.transitionSnapshotIds.includes(candidate.id) && candidate.sequence > intent.effectiveFromSequence);
  const triggerSequence = event?.sequence ?? transition?.sequence ?? null;
  const triggerTime = event?.eventTime ?? transition?.eventTime ?? null;
  if (triggerSequence === null || input.cursor.lastSeenSequence < triggerSequence) {
    return { ...base, state: "ACTIVE", triggerSequence, triggerTime, reason: null, actions: [] };
  }
  const stale = (intent.type === "EARNINGS" || intent.type === "DIVIDEND" || intent.type === "COMPANY_EVENT")
    && triggerTime !== null
    && input.currentTime.getTime() - triggerTime.getTime() >= STALE_AFTER_ACK_MS;
  const reason = intent.type === "EARNINGS"
    ? "The saved results event occurred and you have seen the update."
    : intent.type === "PRICE_LEVEL"
      ? "Your saved price condition was reached and you have seen the update."
      : intent.type === "TECHNICAL"
        ? "Your saved technical condition triggered and you have seen the update."
        : "The saved event occurred and you have seen the update.";
  return {
    ...base,
    state: stale ? "STALE_CANDIDATE" : "RESOLUTION_ELIGIBLE",
    triggerSequence,
    triggerTime,
    reason,
    actions: intent.type === "EARNINGS" || intent.type === "DIVIDEND" ? ["RENEW", "CHANGE", "RESOLVE", "KEEP"] : ["CHANGE", "RESOLVE", "KEEP"],
  };
}

export function nextQuarterLabel(current: string | undefined): string {
  const match = current?.match(/^Q([1-4])$/i);
  if (!match) return "Next quarter";
  const quarter = Number(match[1]);
  return `Q${quarter === 4 ? 1 : quarter + 1}`;
}
