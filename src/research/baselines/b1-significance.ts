// ─────────────────────────────────────────────────────────────────────────────
// Baseline B1: Objective Significance Only
//
// Uses the full V3 significance pipeline (price, volume, event) but
// ignores intent matching, graph traversal, novelty, urgency, and confidence.
// ─────────────────────────────────────────────────────────────────────────────

import type { Baseline, Episode, EpisodePrediction, RankedItem, ScoreComponents } from "../types";
import type { AttentionLane } from "@/domain/attention/types";
import {
  calculatePriceDeltaBps,
  calculateExpectedWindowMoveBps,
  calculatePriceSignificance,
  calculateVolumeRatio,
  volumeSignificanceFromRatio,
  EVENT_SIGNIFICANCE,
  combineSignificance,
} from "@/domain/attention/significance";

export const B1_SIGNIFICANCE: Baseline = {
  id: "B1-significance",
  name: "Objective Significance Only",
  description: "Uses price/volume/event significance but no intent or graph matching.",

  predict(benchmark: { episodes: Episode[] }): EpisodePrediction[] {
    return benchmark.episodes.map((ep) => {
      const startTime = performance.now();

      const snapshots = [...ep.snapshots].sort((a, b) => a.sequence - b.sequence);
      const baseline = snapshots.filter((s) => s.sequence <= ep.cursor.lastSeenSequence).at(-1);
      const current = snapshots.filter((s) => s.sequence <= ep.currentSequence).at(-1);

      if (!baseline || !current) {
        return emptyPrediction(ep, performance.now() - startTime);
      }

      const priceDeltaBps = calculatePriceDeltaBps(baseline.pricePaise, current.pricePaise);
      const expectedWindowMove = calculateExpectedWindowMoveBps(
        snapshots, ep.cursor.lastSeenSequence, ep.currentSequence,
      );
      const priceResult = calculatePriceSignificance(priceDeltaBps, expectedWindowMove);
      const volumeRatio = calculateVolumeRatio(current);
      const volumeSignificance = volumeSignificanceFromRatio(volumeRatio);

      // Event significance from events at or after cursor
      const windowEvents = ep.events.filter(
        (e) => e.sequence > ep.cursor.lastSeenSequence && e.sequence <= ep.currentSequence,
      );
      const localEvents = windowEvents.filter((e) => e.instrumentId === ep.instrument.id);
      const eventSignificance = Math.max(0, ...localEvents.map((e) => EVENT_SIGNIFICANCE[e.type]));

      const combined = combineSignificance(priceResult.significance, volumeSignificance, eventSignificance);

      // Score using ONLY significance (no relevance, novelty, urgency, confidence)
      const score = Math.min(100, combined.significance);

      // Build ranked items by evaluating significance at each step
      const rankedItems = buildSignificanceRankedItems(snapshots, ep, localEvents);

      const lane: AttentionLane =
        score >= 50 ? "SIGNIFICANT" : "QUIET";

      const components: ScoreComponents = {
        significance: combined.significance,
        relevance: 0,
        novelty: 0,
        urgency: 0,
        confidence: 0,
      };

      return {
        episodeId: ep.id,
        scenarioKey: ep.scenarioKey,
        score,
        lane,
        rankedItems,
        components,
        latencyUs: (performance.now() - startTime) * 1000,
        graphNodesVisited: 0,
      };
    });
  },
};

function buildSignificanceRankedItems(
  snapshots: ReturnType<typeof Array.prototype.sort>[0],
  ep: Episode,
  _localEvents: ReturnType<typeof ep.events.filter>,
): RankedItem[] {
  const items: RankedItem[] = [];
  const baseline = snapshots.filter((s: { sequence: number }) => s.sequence <= ep.cursor.lastSeenSequence).at(-1);
  if (!baseline) return items;

  for (let step = ep.cursor.lastSeenSequence + 1; step <= ep.currentSequence; step++) {
    const snap = snapshots.find((s: { sequence: number }) => s.sequence === step);
    if (!snap) continue;

    const bps = Math.abs(calculatePriceDeltaBps(baseline.pricePaise, snap.pricePaise));
    const sig = Math.min(100, bps / 10);

    items.push({
      rank: 0,
      stepIndex: step,
      score: sig,
      lane: sig >= 50 ? "SIGNIFICANT" : "QUIET",
    });
  }

  items.sort((a, b) => b.score - a.score);
  for (let i = 0; i < items.length; i++) items[i].rank = i + 1;
  return items.slice(0, 5);
}

function emptyPrediction(ep: Episode, _latencyMs: number): EpisodePrediction {
  return {
    episodeId: ep.id,
    scenarioKey: ep.scenarioKey,
    score: 0,
    lane: "QUIET",
    rankedItems: [],
    components: { significance: 0, relevance: 0, novelty: 0, urgency: 0, confidence: 0 },
    latencyUs: 0,
    graphNodesVisited: 0,
  };
}
