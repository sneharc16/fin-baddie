// ─────────────────────────────────────────────────────────────────────────────
// Baseline B2: Intent Only
//
// Matches intents directly (no graph, no significance, no price).
// Pure relevance from intent matching.
// ─────────────────────────────────────────────────────────────────────────────

import type { Baseline, Episode, EpisodePrediction, RankedItem, ScoreComponents } from "../types";
import type { AttentionLane } from "@/domain/attention/types";
import { matchIntents } from "@/domain/attention/intent-matchers";

export const B2_INTENT_ONLY: Baseline = {
  id: "B2-intent-only",
  name: "Intent Only",
  description: "Direct intent matching only — no graph traversal, significance, or objective signals.",

  predict(benchmark: { episodes: Episode[] }): EpisodePrediction[] {
    return benchmark.episodes.map((ep) => {
      const startTime = performance.now();

      const snapshots = [...ep.snapshots].sort((a, b) => a.sequence - b.sequence);
      const windowEvents = ep.events.filter(
        (e) => e.sequence > ep.cursor.lastSeenSequence && e.sequence <= ep.currentSequence,
      );
      const localEvents = windowEvents.filter((e) => e.instrumentId === ep.instrument.id);

      const matches = matchIntents({
        intents: ep.intents,
        snapshots,
        events: localEvents,
        cursorSequence: ep.cursor.lastSeenSequence,
        currentSequence: ep.currentSequence,
      });

      // Score based solely on intent matching
      const hasMatch = matches.length > 0;
      const topUrgency = matches[0]?.urgency ?? 0;
      const score = hasMatch ? topUrgency : 0;

      const rankedItems: RankedItem[] = [];
      // Evaluate each step for intent match
      for (let step = ep.cursor.lastSeenSequence + 1; step <= ep.currentSequence; step++) {
        const stepEvents = localEvents.filter((e) => e.sequence <= step);
        const stepMatches = matchIntents({
          intents: ep.intents,
          snapshots: snapshots.filter((s) => s.sequence <= step),
          events: stepEvents,
          cursorSequence: ep.cursor.lastSeenSequence,
          currentSequence: step,
        });

        rankedItems.push({
          rank: 0,
          stepIndex: step,
          score: stepMatches.length > 0 ? stepMatches[0].urgency : 0,
          lane: stepMatches.length > 0 ? "RELEVANT" : "QUIET",
        });
      }

      rankedItems.sort((a, b) => b.score - a.score);
      for (let i = 0; i < rankedItems.length; i++) rankedItems[i].rank = i + 1;

      const lane: AttentionLane = hasMatch ? "RELEVANT" : "QUIET";

      const components: ScoreComponents = {
        significance: 0,
        relevance: hasMatch ? 100 : 0,
        novelty: 0,
        urgency: topUrgency,
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
