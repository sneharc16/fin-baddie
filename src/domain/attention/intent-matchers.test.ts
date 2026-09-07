import { describe, expect, it } from "vitest";
import type { MarketEventRecord, MarketQuality, MarketSnapshotRecord } from "@/domain/market/types";
import type { IntentType, WatchIntentRecord } from "@/domain/intent/types";
import { matchIntents } from "./intent-matchers";

function snapshot(sequence: number, pricePaise: number, quality: MarketQuality = "FRESH"): MarketSnapshotRecord {
  return {
    id: `s${sequence}`, instrumentId: "NSE:TEST", sequence, eventTime: new Date(sequence * 1000), pricePaise,
    openPaise: pricePaise, highPaise: pricePaise, lowPaise: pricePaise, cumulativeVolume: 100n,
    expectedCumulativeVolume: 100n, expectedStepMoveBps: 30, source: "test", quality,
  };
}

function intent(type: IntentType, structuredPayload: unknown, effectiveFromSequence = 0): WatchIntentRecord {
  return {
    id: "v1", logicalIntentId: `logical-${type}`, userId: "demo-user", instrumentId: "NSE:TEST", type,
    originalText: "Watching test condition", structuredPayload, provenanceSource: "MANUAL", provenanceReference: null,
    status: "ACTIVE", version: 1, effectiveFromSequence, resolvedAt: null, resolvedAtSequence: null, lifecycleReviewedThroughSequence: null,
    supersedesId: null, horizon: null, expiresAt: null,
    createdAt: new Date(0), updatedAt: new Date(0),
  };
}

function event(type: MarketEventRecord["type"], payload: Record<string, unknown>, sequence = 1): MarketEventRecord {
  return { id: `event-${type}`, sequence, instrumentId: "NSE:TEST", type, eventTime: new Date(), receivedTime: new Date(), source: "test", quality: "FRESH", payload, subjectType: null, subjectKey: null, tags: [], correctionOfId: null };
}

function matches(watchIntent: WatchIntentRecord, snapshots: MarketSnapshotRecord[] = [snapshot(0, 10000), snapshot(1, 10000)], events: MarketEventRecord[] = []) {
  return matchIntents({ intents: [watchIntent], snapshots, events, cursorSequence: 0, currentSequence: 2 });
}

describe("direct intent matching", () => {
  it("triggers NEAR only when price enters the proximity zone", () => {
    const result = matches(intent("PRICE_LEVEL", { targetPricePaise: 10000, mode: "NEAR", proximityBps: 100 }), [snapshot(0, 10300), snapshot(1, 10050)]);
    expect(result[0]?.reasonCode).toBe("PRICE_TARGET_NEAR_ENTERED");
  });

  it("does not retrigger NEAR while price remains inside", () => {
    expect(matches(intent("PRICE_LEVEL", { targetPricePaise: 10000, mode: "NEAR", proximityBps: 100 }), [snapshot(0, 10050), snapshot(1, 10020)])).toEqual([]);
  });

  it("matches an ABOVE crossing", () => {
    expect(matches(intent("PRICE_LEVEL", { targetPricePaise: 10000, mode: "ABOVE", proximityBps: 100 }), [snapshot(0, 10000), snapshot(1, 10001)])[0]?.reasonCode).toBe("PRICE_TARGET_CROSSED_ABOVE");
  });

  it("matches a BELOW crossing", () => {
    expect(matches(intent("PRICE_LEVEL", { targetPricePaise: 10000, mode: "BELOW", proximityBps: 100 }), [snapshot(0, 10000), snapshot(1, 9999)])[0]?.reasonCode).toBe("PRICE_TARGET_CROSSED_BELOW");
  });

  it("detects an intermediate crossing even if the final price reverses", () => {
    expect(matches(intent("PRICE_LEVEL", { targetPricePaise: 10000, mode: "ABOVE", proximityBps: 100 }), [snapshot(0, 9900), snapshot(1, 10100), snapshot(2, 9800)])).toHaveLength(1);
  });

  it.each(["STALE", "CONFLICTING"] as const)("does not confirm a price transition with %s data", (quality) => {
    expect(matches(intent("PRICE_LEVEL", { targetPricePaise: 10000, mode: "ABOVE", proximityBps: 100 }), [snapshot(0, 9900), snapshot(1, 10100, quality)])).toEqual([]);
  });

  it("matches earnings focus", () => {
    expect(matches(intent("EARNINGS", { focus: ["MARGINS"], quarterLabel: "Q2" }), undefined, [event("RESULTS_PUBLISHED", { focus: ["MARGINS"], quarterLabel: "Q2" })])[0]?.reasonCode).toBe("EARNINGS_EVENT_MATCHED");
  });

  it("does not match a different earnings quarter", () => {
    expect(matches(intent("EARNINGS", { focus: ["MARGINS"], quarterLabel: "Q2" }), undefined, [event("RESULTS_PUBLISHED", { focus: ["MARGINS"], quarterLabel: "Q1" })])).toEqual([]);
  });

  it("matches an exact technical setup and level", () => {
    expect(matches(intent("TECHNICAL", { setup: "BREAKOUT", referenceLevelPaise: 10000 }), undefined, [event("TECHNICAL_TRANSITION", { setup: "BREAKOUT", referenceLevelPaise: 10000 })])[0]?.reasonCode).toBe("TECHNICAL_SETUP_MATCHED");
  });

  it("matches only an exact driver key", () => {
    const watch = intent("DRIVER", { driverKey: "FUEL_COST", description: "Fuel" });
    expect(matches(watch, undefined, [event("EXTERNAL_DRIVER", { driverKey: "FUEL_COST" })])).toHaveLength(1);
    expect(matches(watch, undefined, [event("EXTERNAL_DRIVER", { driverKey: "FX" })])).toEqual([]);
  });

  it("matches a dividend corporate event", () => {
    expect(matches(intent("DIVIDEND", { focus: "EX_DATE" }), undefined, [event("CORPORATE_EVENT", { eventKind: "DIVIDEND", stage: "EX_DATE" })])[0]?.reasonCode).toBe("DIVIDEND_EVENT_MATCHED");
  });

  it("matches an exact company event kind", () => {
    expect(matches(intent("COMPANY_EVENT", { eventKind: "BOARD_CHANGE" }), undefined, [event("CORPORATE_EVENT", { eventKind: "BOARD_CHANGE" })])[0]?.reasonCode).toBe("COMPANY_EVENT_MATCHED");
  });

  it.each(["LONG_TERM", "GENERAL"] as const)("does not infer direct relevance for %s", (type) => {
    expect(matches(intent(type, { note: "Long view" }), undefined, [event("NEWS_EVENT", { headline: "Update" })])).toEqual([]);
  });

  it("does not match an event older than the intent effective sequence", () => {
    expect(matches(intent("EARNINGS", { focus: ["MARGINS"] }, 2), undefined, [event("RESULTS_PUBLISHED", { focus: ["MARGINS"] }, 1)])).toEqual([]);
  });

  it("does not reinterpret an older event with an edited intent version", () => {
    const edited = { ...intent("EARNINGS", { focus: ["MARGINS"] }, 2), id: "v2", version: 2, supersedesId: "v1" };
    expect(matches(edited, undefined, [event("RESULTS_PUBLISHED", { focus: ["MARGINS"] }, 1)])).toEqual([]);
  });
});
