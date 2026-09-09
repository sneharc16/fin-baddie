// ─────────────────────────────────────────────────────────────────────────────
// Baseline B3: Intent + Significance
//
// Combines direct intent matching with objective significance.
// No graph traversal, no novelty/urgency/confidence.
// ─────────────────────────────────────────────────────────────────────────────

import type { Baseline, Episode, EpisodePrediction, RankedItem, ScoreComponents } from "../types";
import type { AttentionLane } from "@/domain/attention/types";
import { matchIntents } from "@/domain/attention/intent-matchers";
import {
  calculatePriceDeltaBps,
  calculateExpectedWindowMoveBps,
  calculatePriceSignificance,
  calculateVolumeRatio,
  volumeSignificanceFromRatio,
  EVENT_SIGNIFICANCE,
  combineSignificance,
} from "@/domain/attention/significance";

export const B3_INTENT_SIGNIFICANCE: Baseline = {
  id: "B3-intent-significance",
  name: "Intent + Significance",
  description: "Combines direct intent matching with objective significance signals.",

  predict(benchmark: { episodes: Episode[] }): EpisodePrediction[] {
    return benchmark.episodes.map((ep) => {
      const startTime = performance.now();

      const snapshots = [...ep.snapshots].sort((a, b) => a.sequence - b.sequence);
      const baseline = snapshots.filter((s) => s.sequence <= ep.cursor.lastSeenSequence).at(-1);
      const current = snapshots.filter((s) => s.sequence <= ep.currentSequence).at(-1);

      const windowEvents = ep.events.filter(
        (e) => e.sequence > ep.cursor.lastSeenSequence && e.sequence <= ep.currentSequence,
      );
      const localEvents = windowEvents.filter((e) => e.instrumentId === ep.instrument.id);

      // Significance
      let sig = 0;
      if (baseline && current) {
        const bps = calculatePriceDeltaBps(baseline.pricePaise, current.pricePaise);
        const expected = calculateExpectedWindowMoveBps(snapshots, ep.cursor.lastSeenSequence, ep.currentSequence);
        const priceResult = calculatePriceSignificance(bps, expected);
        const volRatio = calculateVolumeRatio(current);
        const volSig = volumeSignificanceFromRatio(volRatio);
        const evtSig = Math.max(0, ...localEvents.map((e) => EVENT_SIGNIFICANCE[e.type]));
        const combined = combineSignificance(priceResult.significance, volSig, evtSig);
        sig = combined.significance;
      }

      // Intent
      const matches = matchIntents({
        intents: ep.intents,
        snapshots,
        events: localEvents,
        cursorSequence: ep.cursor.lastSeenSequence,
        currentSequence: ep.currentSequence,
      });
      const relevance = matches.length > 0 ? 100 : 0;

      // Combined score: 50% significance + 50% relevance
      const score = Math.round(0.5 * sig + 0.5 * relevance);

      const rankedItems: RankedItem[] = [];
      for (let step = ep.cursor.lastSeenSequence + 1; step <= ep.currentSequence; step++) {
        const stepSnap = snapshots.filter((s) => s.sequence <= step);
        const stepEvents = localEvents.filter((e) => e.sequence <= step);
        const stepBase = stepSnap.at(0);
        const stepCur = stepSnap.at(stepSnap.length - 1);

        let stepSig = 0;
        if (stepBase && stepCur && stepBase !== stepCur) {
          const bps = calculatePriceDeltaBps(stepBase.pricePaise, stepCur.pricePaise);
          const evtSig = Math.max(0, ...stepEvents.map((e) => EVENT_SIGNIFICANCE[e.type]));
          stepSig = Math.min(100, Math.abs(bps) / 10 + evtSig);
        }

        const stepMatches = matchIntents({
          intents: ep.intents,
          snapshots: stepSnap,
          events: stepEvents,
          cursorSequence: ep.cursor.lastSeenSequence,
          currentSequence: step,
        });
        const stepRel = stepMatches.length > 0 ? 100 : 0;

        const stepScore = Math.round(0.5 * stepSig + 0.5 * stepRel);

        rankedItems.push({
          rank: 0,
          stepIndex: step,
          score: stepScore,
          lane: stepRel > 0 ? "RELEVANT" : stepSig >= 50 ? "SIGNIFICANT" : "QUIET",
        });
      }

      rankedItems.sort((a, b) => b.score - a.score);
      for (let i = 0; i < rankedItems.length; i++) rankedItems[i].rank = i + 1;

      const lane: AttentionLane =
        relevance > 0 ? "RELEVANT" :
        sig >= 50 ? "SIGNIFICANT" :
        "QUIET";

      const components: ScoreComponents = {
        significance: sig,
        relevance,
        novelty: 0,
        urgency: 0,
        confidence: 0,
      };

      return {
        episodeId: ep.id,
        scenarioKey: ep.scenarioKey,
        score,
        lane,
        rankedItems: rankedItems.slice(0, 5),
        components,
        latencyUs: (performance.now() - startTime) * 1000,
        graphNodesVisited: 0,
      };
    });
  },
};
