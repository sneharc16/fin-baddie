// ─────────────────────────────────────────────────────────────────────────────
// Research Metrics
//
// Implements all required metrics for the AIST 2026 paper:
// - NDCG@k, Precision@k, Recall@k (k=5)
// - Mean Reciprocal Rank (MRR)
// - Macro-F1
// - Repeat Surface Rate (RSR)
// - Contextual Recall (CR)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Episode,
  EpisodePrediction,
  MetricResult,
  AggregateMetrics,
} from "../types";
import { EVAL_CONFIG } from "../config";

// ── NDCG@k ──────────────────────────────────────────────────────────────────

/**
 * Normalized Discounted Cumulative Gain at k.
 *
 * Uses binary relevance from gold labels:
 * DCG@k = Σ(i=1..k) rel_i / log2(i+1)
 * IDCG@k = DCG of ideal ranking
 * NDCG@k = DCG@k / IDCG@k
 */
export function ndcgAtK(
  predictions: EpisodePrediction[],
  episodes: Episode[],
  k: number = EVAL_CONFIG.k,
): MetricResult {
  let sum = 0;
  let validCount = 0;

  for (const pred of predictions) {
    const ep = episodes.find((e) => e.id === pred.episodeId);
    if (!ep) continue;

    const goldBinary = ep.goldLabels.binaryRelevance;
    const rankedSteps = pred.rankedItems.slice(0, k);

    // DCG
    let dcg = 0;
    for (let i = 0; i < rankedSteps.length; i++) {
      const relevance = goldBinary[rankedSteps[i].stepIndex] ? 1 : 0;
      dcg += relevance / Math.log2(i + 2); // i+2 because log2(1) = 0
    }

    // IDCG: ideal ranking puts all relevant items first
    const totalRelevant = Object.values(goldBinary).filter(Boolean).length;
    const idealCount = Math.min(totalRelevant, k);
    let idcg = 0;
    for (let i = 0; i < idealCount; i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    if (idcg > 0) {
      sum += dcg / idcg;
    } else {
      // No relevant items: NDCG = 0 if any item is surfaced, 1 if nothing
      sum += rankedSteps.length === 0 ? 1 : 0;
    }
    validCount++;
  }

  const value = validCount > 0 ? sum / validCount : 0;
  return { name: `NDCG@${k}`, value, ci95: null, se: null };
}

// ── Precision@k ─────────────────────────────────────────────────────────────

/**
 * Precision@k = (number of relevant items in top-k) / k
 */
export function precisionAtK(
  predictions: EpisodePrediction[],
  episodes: Episode[],
  k: number = EVAL_CONFIG.k,
): MetricResult {
  let sum = 0;
  let validCount = 0;

  for (const pred of predictions) {
    const ep = episodes.find((e) => e.id === pred.episodeId);
    if (!ep) continue;

    const goldBinary = ep.goldLabels.binaryRelevance;
    const rankedSteps = pred.rankedItems.slice(0, k);

    let relevantInTopK = 0;
    for (const item of rankedSteps) {
      if (goldBinary[item.stepIndex]) {
        relevantInTopK++;
      }
    }

    sum += rankedSteps.length > 0 ? relevantInTopK / k : 0;
    validCount++;
  }

  const value = validCount > 0 ? sum / validCount : 0;
  return { name: `Precision@${k}`, value, ci95: null, se: null };
}

// ── Recall@k ────────────────────────────────────────────────────────────────

/**
 * Recall@k = (number of relevant items in top-k) / (total relevant items)
 */
export function recallAtK(
  predictions: EpisodePrediction[],
  episodes: Episode[],
  k: number = EVAL_CONFIG.k,
): MetricResult {
  let sum = 0;
  let validCount = 0;

  for (const pred of predictions) {
    const ep = episodes.find((e) => e.id === pred.episodeId);
    if (!ep) continue;

    const goldBinary = ep.goldLabels.binaryRelevance;
    const totalRelevant = Object.values(goldBinary).filter(Boolean).length;
    const rankedSteps = pred.rankedItems.slice(0, k);

    if (totalRelevant === 0) {
      // No relevant items: recall is vacuously 1 if nothing surfaced, 0 otherwise
      sum += rankedSteps.length === 0 ? 1 : 0;
    } else {
      let relevantInTopK = 0;
      for (const item of rankedSteps) {
        if (goldBinary[item.stepIndex]) {
          relevantInTopK++;
        }
      }
      sum += relevantInTopK / totalRelevant;
    }
    validCount++;
  }

  const value = validCount > 0 ? sum / validCount : 0;
  return { name: `Recall@${k}`, value, ci95: null, se: null };
}

// ── Mean Reciprocal Rank (MRR) ──────────────────────────────────────────────

/**
 * MRR = mean over episodes of 1/rank_of_first_relevant_item
 */
export function meanReciprocalRank(
  predictions: EpisodePrediction[],
  episodes: Episode[],
): MetricResult {
  let sum = 0;
  let validCount = 0;

  for (const pred of predictions) {
    const ep = episodes.find((e) => e.id === pred.episodeId);
    if (!ep) continue;

    const goldBinary = ep.goldLabels.binaryRelevance;

    // Find the rank of the first relevant item in the prediction
    let rr = 0;
    for (const item of pred.rankedItems) {
      if (goldBinary[item.stepIndex]) {
        rr = 1 / item.rank;
        break;
      }
    }

    sum += rr;
    validCount++;
  }

  const value = validCount > 0 ? sum / validCount : 0;
  return { name: "MRR", value, ci95: null, se: null };
}

// ── Macro-F1 ────────────────────────────────────────────────────────────────

/**
 * Macro-F1 computed per-lane across all episodes.
 * For each lane class (RELEVANT, SIGNIFICANT, QUIET), compute precision and recall,
 * then average F1 across classes.
 */
export function macroF1(
  predictions: EpisodePrediction[],
  episodes: Episode[],
): MetricResult {
  const lanes: Array<"RELEVANT" | "SIGNIFICANT" | "QUIET"> = ["RELEVANT", "SIGNIFICANT", "QUIET"];
  let f1Sum = 0;
  let classCount = 0;

  for (const lane of lanes) {
    let tp = 0;
    let fp = 0;
    let fn = 0;

    for (const pred of predictions) {
      const ep = episodes.find((e) => e.id === pred.episodeId);
      if (!ep) continue;

      const goldLane = ep.goldLabels.lane;
      const predLane = pred.lane;

      if (goldLane === lane && predLane === lane) tp++;
      else if (goldLane !== lane && predLane === lane) fp++;
      else if (goldLane === lane && predLane !== lane) fn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    // Skip classes with no support in either gold or predictions
    if (tp + fp + fn > 0) {
      f1Sum += f1;
      classCount++;
    }
  }

  const value = classCount > 0 ? f1Sum / classCount : 0;
  return { name: "Macro-F1", value, ci95: null, se: null };
}

// ── Weighted-F1 ───────────────────────────────────────────────────────────

/**
 * Weighted-F1 computed per-lane, weighted by class support (number of gold-labeled episodes per lane).
 * Accounts for the QUIET lane imbalance in the benchmark.
 */
export function weightedF1(
  predictions: EpisodePrediction[],
  episodes: Episode[],
): MetricResult {
  const lanes: Array<"RELEVANT" | "SIGNIFICANT" | "QUIET"> = ["RELEVANT", "SIGNIFICANT", "QUIET"];
  let weightedF1Sum = 0;
  let totalSamples = 0;

  for (const lane of lanes) {
    let tp = 0;
    let fp = 0;
    let fn = 0;

    for (const pred of predictions) {
      const ep = episodes.find((e) => e.id === pred.episodeId);
      if (!ep) continue;

      const goldLane = ep.goldLabels.lane;
      const predLane = pred.lane;

      if (goldLane === lane && predLane === lane) tp++;
      else if (goldLane !== lane && predLane === lane) fp++;
      else if (goldLane === lane && predLane !== lane) fn++;
    }

    const support = tp + fn; // Number of gold-labeled instances for this class
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    if (tp + fp + fn > 0) {
      weightedF1Sum += f1 * support;
      totalSamples += support;
    }
  }

  const value = totalSamples > 0 ? weightedF1Sum / totalSamples : 0;
  return { name: "Weighted-F1", value, ci95: null, se: null };
}

// ── Lane Distribution ──────────────────────────────────────────────────────

/**
 * Count gold-label lane distribution across episodes.
 */
export function computeLaneDistribution(
  episodes: Episode[],
): Record<string, number> {
  const dist: Record<string, number> = { RELEVANT: 0, SIGNIFICANT: 0, QUIET: 0 };
  for (const ep of episodes) {
    const lane = ep.goldLabels.lane;
    dist[lane] = (dist[lane] ?? 0) + 1;
  }
  return dist;
}

// ── Repeat Surface Rate (RSR) ──────────────────────────────────────────────

/**
 * Repeat Surface Rate: fraction of episodes where the system surfaces an item
 * that was already surfaced in a previous evaluation of the same scenario.
 *
 * Lower is better — indicates the system doesn't keep showing the same thing.
 */
export function repeatSurfaceRate(
  predictions: EpisodePrediction[],
  episodes: Episode[],
): MetricResult {
  // Group by scenario to detect repeats across episodes of the same scenario
  const byScenario = new Map<string, EpisodePrediction[]>();
  for (const pred of predictions) {
    const list = byScenario.get(pred.scenarioKey) ?? [];
    list.push(pred);
    byScenario.set(pred.scenarioKey, list);
  }

  let repeats = 0;
  let total = 0;

  for (const [, preds] of byScenario) {
    if (preds.length <= 1) continue;

    // Sort by episodeId to ensure deterministic ordering
    const sorted = [...preds].sort((a, b) => a.episodeId.localeCompare(b.episodeId));

    // Track which step indices have been surfaced across episodes of this scenario
    const surfacedStepIndices = new Set<number>();

    for (const pred of sorted) {
      for (const item of pred.rankedItems) {
        if (surfacedStepIndices.has(item.stepIndex)) {
          repeats++;
        }
      }
      // After evaluating this episode, mark its ranked steps as surfaced
      for (const item of pred.rankedItems) {
        surfacedStepIndices.add(item.stepIndex);
      }
      total++;
    }
  }

  const value = total > 0 ? repeats / total : 0;
  return { name: "RepeatSurfaceRate", value, ci95: null, se: null };
}

// ── Contextual Recall (CR) ─────────────────────────────────────────────────

/**
 * Contextual Recall: measures how well the system recalls contextually
 * relevant items (items with high gold relevance score, not just binary).
 *
 * CR = Σ(relevance_score_of_recalled_items) / Σ(all_gold_relevance_scores)
 */
export function contextualRecall(
  predictions: EpisodePrediction[],
  episodes: Episode[],
): MetricResult {
  let sum = 0;
  let validCount = 0;

  for (const pred of predictions) {
    const ep = episodes.find((e) => e.id === pred.episodeId);
    if (!ep) continue;

    const goldRel = ep.goldLabels.stepRelevance;
    const totalGoldRel = Object.values(goldRel).reduce((a, b) => a + b, 0);

    if (totalGoldRel === 0) {
      sum += 1; // Vacuously correct
    } else {
      let recalledRel = 0;
      for (const item of pred.rankedItems) {
        recalledRel += goldRel[item.stepIndex] ?? 0;
      }
      sum += recalledRel / totalGoldRel;
    }
    validCount++;
  }

  const value = validCount > 0 ? sum / validCount : 0;
  return { name: "ContextualRecall", value, ci95: null, se: null };
}

// ── Per-Episode Metrics ─────────────────────────────────────────────────────

/**
 * Compute NDCG@k for a single episode.
 */
export function perEpisodeNDCG(
  pred: EpisodePrediction,
  ep: Episode,
  k: number = EVAL_CONFIG.k,
): number {
  const goldBinary = ep.goldLabels.binaryRelevance;
  const rankedSteps = pred.rankedItems.slice(0, k);

  let dcg = 0;
  for (let i = 0; i < rankedSteps.length; i++) {
    const relevance = goldBinary[rankedSteps[i].stepIndex] ? 1 : 0;
    dcg += relevance / Math.log2(i + 2);
  }

  const totalRelevant = Object.values(goldBinary).filter(Boolean).length;
  const idealCount = Math.min(totalRelevant, k);
  let idcg = 0;
  for (let i = 0; i < idealCount; i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  if (idcg > 0) return dcg / idcg;
  return rankedSteps.length === 0 ? 1 : 0;
}

/**
 * Compute Precision@k for a single episode.
 */
export function perEpisodePrecision(
  pred: EpisodePrediction,
  ep: Episode,
  k: number = EVAL_CONFIG.k,
): number {
  if (pred.rankedItems.length === 0) return 0;
  const goldBinary = ep.goldLabels.binaryRelevance;
  const rankedSteps = pred.rankedItems.slice(0, k);
  let relevantInTopK = 0;
  for (const item of rankedSteps) {
    if (goldBinary[item.stepIndex]) relevantInTopK++;
  }
  return relevantInTopK / k;
}

/**
 * Compute Recall@k for a single episode.
 */
export function perEpisodeRecall(
  pred: EpisodePrediction,
  ep: Episode,
  k: number = EVAL_CONFIG.k,
): number {
  if (pred.rankedItems.length === 0) return 0;
  const goldBinary = ep.goldLabels.binaryRelevance;
  const totalRelevant = Object.values(goldBinary).filter(Boolean).length;
  if (totalRelevant === 0) return 1;
  const rankedSteps = pred.rankedItems.slice(0, k);
  let relevantInTopK = 0;
  for (const item of rankedSteps) {
    if (goldBinary[item.stepIndex]) relevantInTopK++;
  }
  return relevantInTopK / totalRelevant;
}

/**
 * Compute MRR for a single episode.
 */
export function perEpisodeMRR(
  pred: EpisodePrediction,
  ep: Episode,
): number {
  if (pred.rankedItems.length === 0) return 0;
  const goldBinary = ep.goldLabels.binaryRelevance;
  for (const item of pred.rankedItems) {
    if (goldBinary[item.stepIndex]) return 1 / item.rank;
  }
  return 0;
}

/**
 * Compute Macro-F1 for a single episode (1 if lane matches, 0 otherwise).
 */
export function perEpisodeMacroF1(
  pred: EpisodePrediction,
  ep: Episode,
): number {
  return pred.lane === ep.goldLabels.lane ? 1 : 0;
}

// ── Aggregate ───────────────────────────────────────────────────────────────

/**
 * Compute all metrics for a set of predictions.
 */
export function computeAllMetrics(
  predictions: EpisodePrediction[],
  episodes: Episode[],
): AggregateMetrics {
  return {
    ndcgAt5: ndcgAtK(predictions, episodes),
    precisionAt5: precisionAtK(predictions, episodes),
    recallAt5: recallAtK(predictions, episodes),
    repeatSurfaceRate: repeatSurfaceRate(predictions, episodes),
    contextualRecall: contextualRecall(predictions, episodes),
    mrr: meanReciprocalRank(predictions, episodes),
    macroF1: macroF1(predictions, episodes),
    weightedF1: weightedF1(predictions, episodes),
    laneDistribution: computeLaneDistribution(episodes),
  };
}

/**
 * Compute metrics for a subset of episodes (e.g., graph-only episodes).
 */
export function computeSubsetMetrics(
  predictions: EpisodePrediction[],
  episodes: Episode[],
  filter: (ep: Episode) => boolean,
): AggregateMetrics {
  const subsetPreds = predictions.filter((p) => {
    const ep = episodes.find((e) => e.id === p.episodeId);
    return ep && filter(ep);
  });
  const subsetEps = episodes.filter(filter);
  return computeAllMetrics(subsetPreds, subsetEps);
}

/**
 * Extract per-episode metric values for statistical analysis.
 */
export function extractPerEpisodeMetricValues(
  predictions: EpisodePrediction[],
  episodes: Episode[],
): {
  ndcgAt5: number[];
  precisionAt5: number[];
  recallAt5: number[];
  mrr: number[];
  macroF1: number[];
} {
  const ndcgAt5: number[] = [];
  const precisionAt5: number[] = [];
  const recallAt5: number[] = [];
  const mrr: number[] = [];
  const macroF1: number[] = [];

  for (const pred of predictions) {
    const ep = episodes.find((e) => e.id === pred.episodeId);
    if (!ep) continue;

    ndcgAt5.push(perEpisodeNDCG(pred, ep));
    precisionAt5.push(perEpisodePrecision(pred, ep));
    recallAt5.push(perEpisodeRecall(pred, ep));
    mrr.push(perEpisodeMRR(pred, ep));
    macroF1.push(perEpisodeMacroF1(pred, ep));
  }

  return { ndcgAt5, precisionAt5, recallAt5, mrr, macroF1 };
}
