import { describe, expect, it } from "vitest";
import { defaultReplayScenario } from "../../../data/replay/default-scenario";
import type { MarketEventRecord, MarketSnapshotRecord } from "@/domain/market/types";
import { cursorRecord, intentRecord } from "../../../tests/helpers/in-memory";
import { evaluateIntentLifecycle, nextQuarterLabel } from "./lifecycle";

const snapshots: MarketSnapshotRecord[] = defaultReplayScenario.steps.flatMap((step) => step.snapshots.map((snapshot) => ({
  id: `snapshot:${step.sequence}:${snapshot.instrumentId}`, ...snapshot, sequence: step.sequence,
  eventTime: new Date(step.eventTime), source: "ReplayMarketProvider", quality: "FRESH" as const,
})));
const events: MarketEventRecord[] = defaultReplayScenario.events.map((event) => ({
  ...event, eventTime: new Date(event.eventTime), receivedTime: new Date(event.eventTime),
  source: "ReplayMarketProvider", quality: "FRESH", correctionOfId: null,
}));

function evaluate(intent = intentRecord(), cursorSequence = 0, currentSequence = 2) {
  return evaluateIntentLifecycle({
    intent,
    cursor: cursorRecord({ instrumentId: intent.instrumentId, lastSeenSequence: cursorSequence }),
    snapshots: snapshots.filter((snapshot) => snapshot.instrumentId === intent.instrumentId && snapshot.sequence <= currentSequence),
    events: events.filter((event) => event.instrumentId === intent.instrumentId && event.sequence <= currentSequence),
    currentSequence,
    currentTime: new Date(defaultReplayScenario.steps[currentSequence].eventTime),
  });
}

describe("watch intent lifecycle", () => {
  it("keeps earnings active before its event and while its update is unacknowledged", () => {
    expect(evaluate(intentRecord(), 0, 1).state).toBe("ACTIVE");
    expect(evaluate(intentRecord(), 0, 2)).toMatchObject({ state: "ACTIVE", triggerSequence: 2 });
  });

  it("makes acknowledged earnings resolution eligible", () => {
    expect(evaluate(intentRecord(), 2, 2)).toMatchObject({ state: "RESOLUTION_ELIGIBLE", triggerSequence: 2 });
  });

  it("makes acknowledged price and technical transitions resolution eligible", () => {
    const price = intentRecord({ instrumentId: "NSE:HDFCBANK", type: "PRICE_LEVEL", structuredPayload: { targetPricePaise: 155000, mode: "NEAR", proximityBps: 100 } });
    const technical = intentRecord({ instrumentId: "NSE:TATAMOTORS", type: "TECHNICAL", structuredPayload: { setup: "BREAKOUT", referenceLevelPaise: 100000 } });
    expect(evaluate(price, 2).state).toBe("RESOLUTION_ELIGIBLE");
    expect(evaluate(technical, 2).state).toBe("RESOLUTION_ELIGIBLE");
  });

  it("keeps DRIVER intents ongoing after matching events", () => {
    const driver = intentRecord({ instrumentId: "NSE:INDIGO", type: "DRIVER", structuredPayload: { driverKey: "FUEL_COST", description: "Fuel" } });
    expect(evaluate(driver, 2).state).toBe("ACTIVE");
  });

  it("honors an explicit keep-watching review", () => {
    expect(evaluate(intentRecord({ lifecycleReviewedThroughSequence: 2 }), 2).state).toBe("ACTIVE");
  });

  it("returns resolved and archived persisted states", () => {
    expect(evaluate(intentRecord({ status: "RESOLVED", resolvedAtSequence: 2, resolvedAt: new Date() }), 2).state).toBe("RESOLVED");
    expect(evaluate(intentRecord({ status: "ARCHIVED" }), 2).state).toBe("ARCHIVED");
  });

  it("marks an expired active intent as a stale candidate", () => {
    expect(evaluate(intentRecord({ expiresAt: new Date("2025-08-14T04:00:00.000Z") }), 0).state).toBe("STALE_CANDIDATE");
  });

  it("marks an acknowledged earnings question stale after the configured simulated duration", () => {
    expect(evaluate(intentRecord(), 2, 4).state).toBe("STALE_CANDIDATE");
  });

  it("increments deterministic quarter labels", () => {
    expect(nextQuarterLabel("Q2")).toBe("Q3");
    expect(nextQuarterLabel("Q4")).toBe("Q1");
    expect(nextQuarterLabel(undefined)).toBe("Next quarter");
  });
});
