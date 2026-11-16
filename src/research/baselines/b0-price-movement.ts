// ─────────────────────────────────────────────────────────────────────────────
// Baseline B0: Price Movement Only
//
// Ranks episodes solely by absolute price change (basis points).
// No intent matching, no graph traversal, no event significance.
// ─────────────────────────────────────────────────────────────────────────────

import type { Baseline, Episode, EpisodePrediction, RankedItem } from "../types";
import type { AttentionLane } from "@/domain/attention/types";
import { calculatePriceDeltaBps } from "@/domain/attention/significance";

export const B0_PRICE_MOVEMENT: Baseline = {
  id: "B0-price-movement",
  name: "Price Movement Only",
  description: "Ranks by absolute price change in basis points since last cursor position.",

  predict(benchmark: { episodes: Episode[] }): EpisodePrediction[] {
    return benchmark.episodes.map((ep) => {
      const startTime = performance.now();

      const snapshots = [...ep.snapshots].sort((a, b) => a.sequence - b.sequence);
      const baseline = snapshots.filter((s) => s.sequence <= ep.cursor.lastSeenSequence).at(-1);
      const current = snapshots.filter((s) => s.sequence <= ep.currentSequence).at(-1);

      const score = (baseline && current)
        ? Math.min(100, Math.abs(calculatePriceDeltaBps(baseline.pricePaise, current.pricePaise)) / 10)
        : 0;

      const rankedItems: RankedItem[] = [];
      // Rank each step by its absolute price change from cursor
      for (let step = 0; step < snapshots.length; step++) {
        const snap = snapshots[step];
        if (!baseline || step <= ep.cursor.lastSeenSequence) continue;

        const bps = Math.abs(calculatePriceDeltaBps(baseline.pricePaise, snap.pricePaise));
        rankedItems.push({
          rank: 0,
          stepIndex: step,
          score: Math.min(100, bps / 10),
          lane: "QUIET" as AttentionLane,
        });
      }

      rankedItems.sort((a, b) => b.score - a.score);
      for (let i = 0; i < rankedItems.length; i++) rankedItems[i].rank = i + 1;

      const lane: AttentionLane = score > 0 ? "SIGNIFICANT" : "QUIET";
      const latencyUs = (performance.now() - startTime) * 1000;

      return {
        episodeId: ep.id,
        scenarioKey: ep.scenarioKey,
        score,
        lane,
        rankedItems: rankedItems.slice(0, 5),
        components: { significance: score, relevance: 0, novelty: 0, urgency: 0, confidence: 0 },
        latencyUs,
        graphNodesVisited: 0,
      };
    });
  },
};
