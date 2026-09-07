import type { WatchIntentRecord } from "@/domain/intent/types";
import type { MarketEventRecord, MarketQuality, MarketSnapshotRecord } from "@/domain/market/types";
import {
  companyEventPayloadSchema,
  dividendPayloadSchema,
  driverPayloadSchema,
  earningsPayloadSchema,
  priceLevelPayloadSchema,
  technicalPayloadSchema,
} from "@/domain/intent/schemas";
import type { IntentMatch } from "./types";

const blockedPriceQualities: MarketQuality[] = ["STALE", "CONFLICTING"];
const payload = (event: MarketEventRecord) => event.payload as Record<string, unknown>;

function priceMatch(intent: WatchIntentRecord, snapshots: MarketSnapshotRecord[], floor: number): IntentMatch | null {
  const parsed = priceLevelPayloadSchema.safeParse(intent.structuredPayload);
  if (!parsed.success) return null;
  const ordered = [...snapshots].sort((a, b) => a.sequence - b.sequence);
  let previous = ordered.filter((snapshot) => snapshot.sequence <= floor).at(-1);
  if (!previous) return null;
  for (const current of ordered.filter((snapshot) => snapshot.sequence > floor)) {
    const qualityAllowsConfirmation = !blockedPriceQualities.includes(previous.quality) && !blockedPriceQualities.includes(current.quality);
    const target = parsed.data.targetPricePaise;
    const previousNear = Math.abs(previous.pricePaise - target) / target * 10_000 <= parsed.data.proximityBps;
    const currentNear = Math.abs(current.pricePaise - target) / target * 10_000 <= parsed.data.proximityBps;
    const reasonCode = parsed.data.mode === "NEAR" && !previousNear && currentNear
      ? "PRICE_TARGET_NEAR_ENTERED"
      : parsed.data.mode === "ABOVE" && previous.pricePaise <= target && current.pricePaise > target
        ? "PRICE_TARGET_CROSSED_ABOVE"
        : parsed.data.mode === "BELOW" && previous.pricePaise >= target && current.pricePaise < target
          ? "PRICE_TARGET_CROSSED_BELOW"
          : null;
    if (qualityAllowsConfirmation && reasonCode) {
      return {
        matchType: "DIRECT",
        logicalIntentId: intent.logicalIntentId,
        version: intent.version,
        type: intent.type,
        originalText: intent.originalText,
        reasonCode,
        urgency: reasonCode === "PRICE_TARGET_NEAR_ENTERED" ? 80 : 100,
        relevance: 100,
        eventIds: [],
        transitionSnapshotIds: [previous.id, current.id],
        metadata: { targetPricePaise: target, fromPricePaise: previous.pricePaise, toPricePaise: current.pricePaise },
        graphMatch: null,
      };
    }
    previous = current;
  }
  return null;
}

function eventMatch(intent: WatchIntentRecord, events: MarketEventRecord[]): IntentMatch | null {
  const match = (event: MarketEventRecord, reasonCode: IntentMatch["reasonCode"], urgency: number, metadata: Record<string, string | number> = {}): IntentMatch => ({
    matchType: "DIRECT",
    logicalIntentId: intent.logicalIntentId,
    version: intent.version,
    type: intent.type,
    originalText: intent.originalText,
    reasonCode,
    urgency,
    relevance: 100,
    eventIds: [event.id],
    transitionSnapshotIds: [],
    metadata,
    graphMatch: null,
  });

  if (intent.type === "EARNINGS") {
    const parsed = earningsPayloadSchema.safeParse(intent.structuredPayload);
    if (!parsed.success) return null;
    const event = events.find((candidate) => {
      if (candidate.type !== "RESULTS_PUBLISHED") return false;
      const data = payload(candidate);
      if (parsed.data.quarterLabel && data.quarterLabel && data.quarterLabel !== parsed.data.quarterLabel) return false;
      if (parsed.data.focus.includes("ALL_KEY_CHANGES")) return true;
      const eventFocus = Array.isArray(data.focus) ? data.focus.filter((item): item is string => typeof item === "string") : [];
      return parsed.data.focus.some((focus) => eventFocus.includes(focus));
    });
    return event ? match(event, "EARNINGS_EVENT_MATCHED", 70, { quarterLabel: String(payload(event).quarterLabel ?? "") }) : null;
  }

  if (intent.type === "TECHNICAL") {
    const parsed = technicalPayloadSchema.safeParse(intent.structuredPayload);
    if (!parsed.success) return null;
    const event = events.find((candidate) => candidate.type === "TECHNICAL_TRANSITION"
      && payload(candidate).setup === parsed.data.setup
      && (parsed.data.referenceLevelPaise === undefined || payload(candidate).referenceLevelPaise === undefined || payload(candidate).referenceLevelPaise === parsed.data.referenceLevelPaise));
    return event ? match(event, "TECHNICAL_SETUP_MATCHED", 70, { setup: parsed.data.setup }) : null;
  }

  if (intent.type === "DRIVER") {
    const parsed = driverPayloadSchema.safeParse(intent.structuredPayload);
    if (!parsed.success) return null;
    const event = events.find((candidate) => candidate.type === "EXTERNAL_DRIVER" && payload(candidate).driverKey === parsed.data.driverKey);
    return event ? match(event, "DRIVER_EVENT_MATCHED", 60, { driverKey: parsed.data.driverKey }) : null;
  }

  if (intent.type === "DIVIDEND") {
    const parsed = dividendPayloadSchema.safeParse(intent.structuredPayload);
    if (!parsed.success) return null;
    const event = events.find((candidate) => {
      if (candidate.type !== "CORPORATE_EVENT" || payload(candidate).eventKind !== "DIVIDEND") return false;
      const stage = payload(candidate).stage;
      return parsed.data.focus === "GENERAL" || stage === undefined || stage === parsed.data.focus;
    });
    return event ? match(event, "DIVIDEND_EVENT_MATCHED", 60, { focus: parsed.data.focus }) : null;
  }

  if (intent.type === "COMPANY_EVENT") {
    const parsed = companyEventPayloadSchema.safeParse(intent.structuredPayload);
    if (!parsed.success) return null;
    const event = events.find((candidate) => candidate.type === "CORPORATE_EVENT" && payload(candidate).eventKind === parsed.data.eventKind);
    return event ? match(event, "COMPANY_EVENT_MATCHED", 60, { eventKind: parsed.data.eventKind }) : null;
  }

  return null;
}

export function matchIntents(input: {
  intents: WatchIntentRecord[];
  snapshots: MarketSnapshotRecord[];
  events: MarketEventRecord[];
  cursorSequence: number;
  currentSequence: number;
}): IntentMatch[] {
  const matches = input.intents.flatMap((intent) => {
    const demoEffectiveSequence = Math.min(intent.effectiveFromSequence, input.currentSequence);
    const effectiveFloor = Math.max(input.cursorSequence, demoEffectiveSequence);
    if (input.currentSequence <= effectiveFloor) return [];
    const eligibleEvents = input.events.filter((event) => event.sequence > effectiveFloor && event.sequence <= input.currentSequence);
    const found = intent.type === "PRICE_LEVEL"
      ? priceMatch(intent, input.snapshots, effectiveFloor)
      : eventMatch(intent, eligibleEvents);
    return found ? [found] : [];
  });
  return matches.sort((a, b) => b.urgency - a.urgency || a.logicalIntentId.localeCompare(b.logicalIntentId));
}
