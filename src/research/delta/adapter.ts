// ─────────────────────────────────────────────────────────────────────────────
// Research Delta Adapter
//
// Wraps the existing V3 analyzeInstrument logic as a pure evaluation function.
// Uses the EXACT same scoring formula, lane logic, and graph bounds.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Episode,
  EpisodePrediction,
  RankedItem,
  ScoreComponents,
} from "../types";
import type { AttentionItem, AttentionLane } from "@/domain/attention/types";
import { analyzeInstrument } from "@/domain/attention/analyze-instrument";

export interface DeltaAdapterOptions {
  /** Zero out specified components for ablation studies */
  disableComponents?: Array<keyof ScoreComponents>;
  /** Use equal weights instead of V3 weights */
  equalWeights?: boolean;
  /** Custom weight overrides */
  weightOverrides?: Partial<ScoreComponents>;
}

/**
 * Evaluate a single episode using the V3 Delta attention logic.
 * Returns a prediction object suitable for metric computation.
 */
export function evaluateEpisode(
  episode: Episode,
  options: DeltaAdapterOptions = {},
): EpisodePrediction {
  const startTime = performance.now();

  // Build the attention analysis input
  const input = {
    instrument: episode.instrument,
    cursor: episode.cursor,
    currentSequence: episode.currentSequence,
    currentTime: episode.currentTime,
    snapshots: episode.snapshots,
    events: episode.events,
    activeIntents: episode.intents,
    activeGraphs: episode.graphs,
  };

  // Run the existing V3 analysis
  const result: AttentionItem | null = analyzeInstrument(input);

  const latencyUs = (performance.now() - startTime) * 1000;

  if (!result) {
    return {
      episodeId: episode.id,
      scenarioKey: episode.scenarioKey,
      score: 0,
      lane: "QUIET",
      rankedItems: [],
      components: { significance: 0, relevance: 0, novelty: 0, urgency: 0, confidence: 0 },
      latencyUs,
      graphNodesVisited: 0,
    };
  }

  // Extract raw components from the result
  let components: ScoreComponents = {
    significance: result.significance,
    relevance: result.relevance,
    novelty: result.novelty,
    urgency: result.urgency,
    confidence: result.confidence,
  };

  // Apply ablation overrides
  if (options.disableComponents) {
    for (const comp of options.disableComponents) {
      components[comp] = 0;
    }
  }

  if (options.equalWeights) {
    components = {
      significance: components.significance,
      relevance: components.relevance,
      novelty: components.novelty,
      urgency: components.urgency,
      confidence: components.confidence,
    };
  }

  // Recompute score from (possibly modified) components
  // Always recompute when components were modified to ensure ablations take effect
  const score = options.equalWeights
    ? computeEqualWeightScore(components)
    : options.weightOverrides
      ? computeCustomScore(components, options.weightOverrides)
    : options.disableComponents && options.disableComponents.length > 0
      ? Math.max(0, Math.min(100, Math.round(
          0.30 * components.significance
          + 0.35 * components.relevance
          + 0.15 * components.novelty
          + 0.10 * components.urgency
          + 0.10 * components.confidence,
        )))
      : result.score;

  // Recompute lane from (possibly modified) relevance
  const lane: AttentionLane =
    components.relevance > 0 ? "RELEVANT" :
    components.significance >= 50 ? "SIGNIFICANT" :
    "QUIET";

  // Build ranked items: map each step's attention to a ranking
  // For simplicity, we evaluate each step as a potential "item" to surface
  const rankedItems = buildRankedItems(episode, options);

  // Count graph nodes visited
  const graphNodesVisited = countGraphNodesVisited(episode);

  return {
    episodeId: episode.id,
    scenarioKey: episode.scenarioKey,
    score,
    lane,
    rankedItems,
    components,
    latencyUs,
    graphNodesVisited,
  };
}

/**
 * Run evaluation across all episodes in a benchmark.
 */
export function evaluateBenchmark(
  episodes: Episode[],
  options: DeltaAdapterOptions = {},
): EpisodePrediction[] {
  return episodes.map((ep) => evaluateEpisode(ep, options));
}

// ── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Build a ranked list of items by evaluating each step in the catch-up window.
 * Uses the episode's actual cursor position (fixed) and evaluates each step
 * as a progressively expanding window from that cursor.
 *
 * Steps in the window are ranked by their individual attention scores.
 * Steps before the cursor are excluded (already seen by user).
 */
function buildRankedItems(
  episode: Episode,
  options: DeltaAdapterOptions,
): RankedItem[] {
  const items: RankedItem[] = [];
  const sortedSnapshots = [...episode.snapshots].sort((a, b) => a.sequence - b.sequence);
  const cursorSeq = episode.cursor.lastSeenSequence;

  // Only evaluate steps AFTER the cursor (within the catch-up window)
  for (let step = cursorSeq + 1; step <= episode.currentSequence; step++) {
    const snap = sortedSnapshots.find((s) => s.sequence === step);
    if (!snap) continue;

    // Use the episode's actual cursor — evaluate the expanding window from cursor to this step
    const miniInput = {
      instrument: episode.instrument,
      cursor: episode.cursor,
      currentSequence: step,
      currentTime: snap.eventTime,
      snapshots: sortedSnapshots.filter((s) => s.sequence <= step),
      events: episode.events.filter((e) => e.sequence <= step),
      activeIntents: episode.intents,
      activeGraphs: episode.graphs,
    };

    const result = analyzeInstrument(miniInput);
    if (!result) {
      items.push({
        rank: 0,
        stepIndex: step,
        score: 0,
        lane: "QUIET",
      });
      continue;
    }

    let score = result.score;
    let relevance = result.relevance;
    let significance = result.significance;

    // Apply ablations
    if (options.disableComponents && options.disableComponents.length > 0) {
      let s = 0;
      const c = {
        significance: options.disableComponents.includes("significance") ? 0 : result.significance,
        relevance: options.disableComponents.includes("relevance") ? 0 : result.relevance,
        novelty: options.disableComponents.includes("novelty") ? 0 : result.novelty,
        urgency: options.disableComponents.includes("urgency") ? 0 : result.urgency,
        confidence: options.disableComponents.includes("confidence") ? 0 : result.confidence,
      };
      if (options.equalWeights) {
        s = (c.significance + c.relevance + c.novelty + c.urgency + c.confidence) / 5;
      } else {
        s = 0.30 * c.significance + 0.35 * c.relevance + 0.15 * c.novelty + 0.10 * c.urgency + 0.10 * c.confidence;
      }
      score = Math.max(0, Math.min(100, Math.round(s)));
      relevance = c.relevance;
      significance = c.significance;
    }

    const lane: AttentionLane =
      relevance > 0 ? "RELEVANT" :
      significance >= 50 ? "SIGNIFICANT" :
      "QUIET";

    items.push({
      rank: 0,
      stepIndex: step,
      score,
      lane,
    });
  }

  // Sort by score descending, assign ranks
  items.sort((a, b) => b.score - a.score || a.stepIndex - b.stepIndex);
  for (let i = 0; i < items.length; i++) {
    items[i].rank = i + 1;
  }

  // Return top-5 only
  return items.slice(0, 5);
}

/**
 * Count graph nodes visited during BFS traversal.
 * Simulates the actual graph traversal logic from domain/graph/traversal.ts
 * with MAX_GRAPH_DEPTH = 3 and MAX_GRAPH_VISITED_NODES = 25.
 */
function countGraphNodesVisited(episode: Episode): number {
  if (episode.graphs.length === 0) return 0;

  const MAX_DEPTH = 3;
  const MAX_VISITED = 25;
  let total = 0;

  for (const graph of episode.graphs) {
    // Find root (INSTRUMENT node)
    const root = graph.nodes.find((n) => n.type === "INSTRUMENT");
    if (!root) continue;

    // Build adjacency from edges
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    const outgoing = new Map<string, typeof graph.edges>();
    for (const edge of graph.edges) {
      outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge]);
    }

    // BFS
    let visited = 0;
    const queue = [{ nodeId: root.id, depth: 0 }];
    const seen = new Set<string>();

    while (queue.length > 0 && visited < MAX_VISITED) {
      const { nodeId, depth } = queue.shift()!;
      if (seen.has(nodeId)) continue;
      seen.add(nodeId);
      visited++;

      if (depth >= MAX_DEPTH) continue;
      for (const edge of outgoing.get(nodeId) ?? []) {
        if (!seen.has(edge.toNodeId)) {
          queue.push({ nodeId: edge.toNodeId, depth: depth + 1 });
        }
      }
    }

    total += visited;
  }
  return total;
}

/**
 * Compute score using equal weights (each component = 20%).
 */
function computeEqualWeightScore(c: ScoreComponents): number {
  const score =
    0.20 * c.significance +
    0.20 * c.relevance +
    0.20 * c.novelty +
    0.20 * c.urgency +
    0.20 * c.confidence;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Compute score with custom weight overrides.
 */
function computeCustomScore(
  c: ScoreComponents,
  overrides: Partial<ScoreComponents>,
): number {
  const weights = {
    significance: overrides.significance ?? 0.30,
    relevance: overrides.relevance ?? 0.35,
    novelty: overrides.novelty ?? 0.15,
    urgency: overrides.urgency ?? 0.10,
    confidence: overrides.confidence ?? 0.10,
  };

  // Normalize weights to sum to 1
  const total = weights.significance + weights.relevance + weights.novelty + weights.urgency + weights.confidence;
  const w = {
    significance: weights.significance / total,
    relevance: weights.relevance / total,
    novelty: weights.novelty / total,
    urgency: weights.urgency / total,
    confidence: weights.confidence / total,
  };

  const score =
    w.significance * c.significance +
    w.relevance * c.relevance +
    w.novelty * c.novelty +
    w.urgency * c.urgency +
    w.confidence * c.confidence;
  return Math.max(0, Math.min(100, Math.round(score)));
}
