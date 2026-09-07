import { describe, expect, it } from "vitest";
import type { MarketSnapshotRecord } from "@/domain/market/types";
import {
  calculateExpectedWindowMoveBps,
  calculatePriceDeltaBps,
  calculatePriceSignificance,
  combineSignificance,
  EVENT_SIGNIFICANCE,
  priceSignificanceFromSurprise,
  volumeSignificanceFromRatio,
} from "./significance";
import { calculateAttentionScore, classifyLane } from "./scoring";

function snapshot(sequence: number, expectedStepMoveBps: number | null): MarketSnapshotRecord {
  return {
    id: `s${sequence}`, instrumentId: "NSE:TEST", sequence, eventTime: new Date(), pricePaise: 10000,
    openPaise: 10000, highPaise: 10000, lowPaise: 10000, cumulativeVolume: 100n,
    expectedCumulativeVolume: 100n, expectedStepMoveBps, source: "test", quality: "FRESH",
  };
}

describe("objective significance", () => {
  it("calculates signed price delta in basis points", () => {
    expect(calculatePriceDeltaBps(10000, 10100)).toBeCloseTo(100);
    expect(calculatePriceDeltaBps(10000, 9900)).toBeCloseTo(-100);
  });

  it("combines expected interval moves as sqrt of summed variance", () => {
    expect(calculateExpectedWindowMoveBps([snapshot(0, 30), snapshot(1, 30), snapshot(2, 40)], 0, 2)).toBe(50);
  });

  it("returns no expected window when interval metadata is unavailable", () => {
    expect(calculateExpectedWindowMoveBps([snapshot(0, 30), snapshot(1, null)], 0, 1)).toBeNull();
  });

  it.each([
    [0.99, 0], [1, 30], [1.49, 30], [1.5, 50], [1.99, 50], [2, 70], [2.99, 70], [3, 90],
  ])("maps price surprise %s to %s", (surprise, expected) => {
    expect(priceSignificanceFromSurprise(surprise)).toBe(expected);
  });

  it("falls back to absolute basis-point thresholds without expected movement", () => {
    expect(calculatePriceSignificance(49, null)).toEqual({ priceSurprise: null, significance: 0 });
    expect(calculatePriceSignificance(100, null).significance).toBe(50);
    expect(calculatePriceSignificance(-400, null).significance).toBe(90);
  });

  it.each([
    [1.29, 0], [1.3, 30], [1.5, 50], [2, 70], [3, 90],
  ])("maps volume ratio %s to %s", (ratio, expected) => {
    expect(volumeSignificanceFromRatio(ratio)).toBe(expected);
  });

  it("uses the central event significance mapping", () => {
    expect(EVENT_SIGNIFICANCE.RESULTS_PUBLISHED).toBe(90);
    expect(EVENT_SIGNIFICANCE.CORPORATE_EVENT).toBe(80);
    expect(EVENT_SIGNIFICANCE.QUOTE_UPDATE).toBe(0);
  });

  it("adds and caps the multi-signal bonus", () => {
    expect(combineSignificance(50, 70, 0)).toEqual({ significance: 80, multipleSignals: true });
    expect(combineSignificance(90, 70, 80)).toEqual({ significance: 100, multipleSignals: true });
    expect(combineSignificance(0, 0, 60)).toEqual({ significance: 60, multipleSignals: false });
  });

  it("uses the exact attention score formula", () => {
    expect(calculateAttentionScore({ significance: 80, relevance: 100, novelty: 100, urgency: 70, confidence: 100 })).toBe(91);
  });

  it("classifies relevance before objective significance", () => {
    expect(classifyLane(100, 0)).toBe("RELEVANT");
  });

  it("requires significance 50 for a non-relevant significant lane", () => {
    expect(classifyLane(0, 50)).toBe("SIGNIFICANT");
    expect(classifyLane(0, 49)).toBe("QUIET");
  });
});
