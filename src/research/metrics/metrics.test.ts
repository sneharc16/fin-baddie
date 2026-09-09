import { describe, expect, it } from "vitest";
import {
  ndcgAtK,
  precisionAtK,
  recallAtK,
  meanReciprocalRank,
  macroF1,
  repeatSurfaceRate,
  contextualRecall,
} from "./index";
import type { EpisodePrediction, Episode } from "../types";

function makeEpisode(id: string, goldRelevance: Record<number, boolean>, lane: "RELEVANT" | "SIGNIFICANT" | "QUIET" = "QUIET"): Episode {
  return {
    id,
    seed: 0,
    scenarioKey: `scenario-${id}`,
    evalStep: 4,
    snapshots: [],
    events: [],
    intents: [],
    graphs: [],
    cursor: { id: "c", userId: "u", instrumentId: "i", lastSeenSequence: 0, lastSeenEventTime: null, lastObservedSnapshotId: null, cursorVersion: 1, createdAt: new Date(), updatedAt: new Date() },
    currentSequence: 4,
    currentTime: new Date(),
    instrument: { id: "i", symbol: "T", exchange: "NSE", name: "Test", sector: null, currency: "INR", isActive: true },
    goldLabels: {
      stepRelevance: Object.fromEntries(Object.entries(goldRelevance).map(([k, v]) => [k, v ? 100 : 0])),
      binaryRelevance: goldRelevance,
      lane,
      rationale: "test",
    },
  };
}

function makePrediction(episodeId: string, rankedSteps: number[], lane: "RELEVANT" | "SIGNIFICANT" | "QUIET" = "QUIET"): EpisodePrediction {
  return {
    episodeId,
    scenarioKey: `scenario-${episodeId}`,
    score: rankedSteps.length > 0 ? 80 : 0,
    lane,
    rankedItems: rankedSteps.map((stepIdx, i) => ({ rank: i + 1, stepIndex: stepIdx, score: 80 - i * 10, lane: "RELEVANT" })),
    components: { significance: 80, relevance: 80, novelty: 0, urgency: 0, confidence: 0 },
    latencyUs: 100,
    graphNodesVisited: 0,
  };
}

describe("NDCG@k", () => {
  it("returns 1.0 when all top-k items are relevant", () => {
    const episodes = [makeEpisode("ep1", { 0: true, 1: true, 2: true, 3: false, 4: false })];
    const predictions = [makePrediction("ep1", [0, 1, 2])];
    const result = ndcgAtK(predictions, episodes, 5);
    expect(result.value).toBe(1.0);
  });

  it("returns 0 when no items in top-k are relevant", () => {
    const episodes = [makeEpisode("ep1", { 0: false, 1: false, 2: false, 3: true, 4: true })];
    const predictions = [makePrediction("ep1", [0, 1, 2])];
    const result = ndcgAtK(predictions, episodes, 5);
    expect(result.value).toBe(0);
  });

  it("handles empty predictions gracefully", () => {
    const episodes = [makeEpisode("ep1", { 0: true })];
    const predictions = [makePrediction("ep1", [])];
    const result = ndcgAtK(predictions, episodes, 5);
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
  });
});

describe("Precision@k", () => {
  it("returns 1.0 when all top-5 are relevant", () => {
    const episodes = [makeEpisode("ep1", { 0: true, 1: true, 2: true, 3: true, 4: true })];
    const predictions = [makePrediction("ep1", [0, 1, 2, 3, 4])];
    const result = precisionAtK(predictions, episodes, 5);
    expect(result.value).toBe(1.0);
  });

  it("returns 0 when no top-5 are relevant", () => {
    const episodes = [makeEpisode("ep1", { 5: true, 6: true })];
    const predictions = [makePrediction("ep1", [0, 1, 2, 3, 4])];
    const result = precisionAtK(predictions, episodes, 5);
    expect(result.value).toBe(0);
  });

  it("returns correct precision for partial matches", () => {
    const episodes = [makeEpisode("ep1", { 0: true, 1: true, 2: false, 3: false, 4: false })];
    const predictions = [makePrediction("ep1", [0, 1, 2, 3, 4])];
    const result = precisionAtK(predictions, episodes, 5);
    expect(result.value).toBeCloseTo(0.4); // 2/5
  });
});

describe("Recall@k", () => {
  it("returns 1.0 when all relevant items are in top-k", () => {
    const episodes = [makeEpisode("ep1", { 0: true, 1: true })];
    const predictions = [makePrediction("ep1", [0, 1, 2, 3, 4])];
    const result = recallAtK(predictions, episodes, 5);
    expect(result.value).toBe(1.0);
  });

  it("returns 0 when no relevant items are in top-k", () => {
    const episodes = [makeEpisode("ep1", { 0: true, 1: true })];
    const predictions = [makePrediction("ep1", [2, 3, 4])];
    const result = recallAtK(predictions, episodes, 5);
    expect(result.value).toBe(0);
  });

  it("handles no relevant items (vacuously correct)", () => {
    const episodes = [makeEpisode("ep1", { 0: false, 1: false, 2: false, 3: false, 4: false })];
    const predictions = [makePrediction("ep1", [])];
    const result = recallAtK(predictions, episodes, 5);
    expect(result.value).toBe(1.0); // Vacuously correct
  });
});

describe("MRR", () => {
  it("returns 1.0 when first item is relevant", () => {
    const episodes = [makeEpisode("ep1", { 0: true, 1: false })];
    const predictions = [makePrediction("ep1", [0, 1])];
    const result = meanReciprocalRank(predictions, episodes);
    expect(result.value).toBe(1.0);
  });

  it("returns 0.5 when second item is relevant", () => {
    const episodes = [makeEpisode("ep1", { 0: false, 1: true })];
    const predictions = [makePrediction("ep1", [0, 1])];
    const result = meanReciprocalRank(predictions, episodes);
    expect(result.value).toBeCloseTo(0.5);
  });

  it("returns 0 when no items are relevant", () => {
    const episodes = [makeEpisode("ep1", { 5: true })];
    const predictions = [makePrediction("ep1", [0, 1])];
    const result = meanReciprocalRank(predictions, episodes);
    expect(result.value).toBe(0);
  });
});

describe("Macro-F1", () => {
  it("returns 1.0 when all predictions match gold lanes", () => {
    const episodes = [
      makeEpisode("ep1", { 0: true }, "RELEVANT"),
      makeEpisode("ep2", { 0: false }, "QUIET"),
    ];
    const predictions = [
      makePrediction("ep1", [0], "RELEVANT"),
      makePrediction("ep2", [], "QUIET"),
    ];
    const result = macroF1(predictions, episodes);
    expect(result.value).toBe(1.0);
  });

  it("returns < 1 when predictions don't match", () => {
    const episodes = [
      makeEpisode("ep1", { 0: true }, "RELEVANT"),
    ];
    const predictions = [
      makePrediction("ep1", [], "QUIET"),
    ];
    const result = macroF1(predictions, episodes);
    expect(result.value).toBeLessThan(1.0);
  });
});

describe("Repeat Surface Rate", () => {
  it("returns 0 when no repeats across scenarios", () => {
    const episodes = [
      makeEpisode("ep1", { 0: true }),
      makeEpisode("ep2", { 0: true }),
    ];
    const predictions = [
      makePrediction("ep1", [0]),
      makePrediction("ep2", [0]),
    ];
    // Different episode IDs, so no repeat
    const result = repeatSurfaceRate(predictions, episodes);
    expect(result.value).toBe(0);
  });
});

describe("Contextual Recall", () => {
  it("returns 1.0 when all gold relevance is recalled", () => {
    const episodes = [makeEpisode("ep1", { 0: true, 1: true })];
    // Override stepRelevance to have actual values
    episodes[0].goldLabels.stepRelevance = { 0: 100, 1: 80 };
    const predictions = [makePrediction("ep1", [0, 1])];
    const result = contextualRecall(predictions, episodes);
    expect(result.value).toBeCloseTo(1.0);
  });

  it("returns 0 when nothing is recalled", () => {
    const episodes = [makeEpisode("ep1", { 0: true })];
    episodes[0].goldLabels.stepRelevance = { 0: 100 };
    const predictions = [makePrediction("ep1", [])];
    const result = contextualRecall(predictions, episodes);
    expect(result.value).toBe(0);
  });
});
