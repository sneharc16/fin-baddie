// ─────────────────────────────────────────────────────────────────────────────
// Scale Benchmark
//
// Measures:
// - p50/p95/p99 latency per episode
// - Throughput (episodes per second)
// - Graph nodes visited (p50/p95)
// ─────────────────────────────────────────────────────────────────────────────

import type { Episode, EpisodePrediction, ScaleMetrics } from "../types";
import { evaluateEpisode } from "../delta/adapter";
import { SCALE_CONFIG } from "../config";

export interface ScaleBenchmarkResult {
  metrics: ScaleMetrics;
  perEpisodeLatencyUs: number[];
  perEpisodeGraphNodes: number[];
}

/**
 * Run the scale benchmark with warm-up iterations.
 *
 * For each episode, we run the evaluation multiple times and measure latency.
 * The first N iterations are warm-up (discarded), then we collect stats.
 */
export function runScaleBenchmark(
  episodes: Episode[],
): ScaleBenchmarkResult {
  const perEpisodeLatencyUs: number[] = [];
  const perEpisodeGraphNodes: number[] = [];
  const allLatencies: number[] = [];

  // Warm-up phase
  for (let w = 0; w < SCALE_CONFIG.warmupIterations; w++) {
    for (const ep of episodes) {
      evaluateEpisode(ep);
    }
  }

  // Measurement phase
  const wallStartTime = performance.now();

  for (let m = 0; m < SCALE_CONFIG.measuredIterations; m++) {
    for (const ep of episodes) {
      const result = evaluateEpisode(ep);
      allLatencies.push(result.latencyUs);

      // Only record per-episode stats on first measurement iteration
      if (m === 0) {
        perEpisodeLatencyUs.push(result.latencyUs);
        perEpisodeGraphNodes.push(result.graphNodesVisited);
      }
    }
  }

  const wallTimeMs = performance.now() - wallStartTime;
  const totalMeasurements = SCALE_CONFIG.measuredIterations * episodes.length;

  // Compute percentiles
  allLatencies.sort((a, b) => a - b);
  const p50Idx = Math.floor(0.50 * allLatencies.length);
  const p95Idx = Math.floor(0.95 * allLatencies.length);
  const p99Idx = Math.floor(0.99 * allLatencies.length);

  perEpisodeGraphNodes.sort((a, b) => a - b);
  const gnP50Idx = Math.floor(0.50 * perEpisodeGraphNodes.length);
  const gnP95Idx = Math.floor(0.95 * perEpisodeGraphNodes.length);

  const metrics: ScaleMetrics = {
    p50LatencyUs: allLatencies[p50Idx] ?? 0,
    p95LatencyUs: allLatencies[p95Idx] ?? 0,
    p99LatencyUs: allLatencies[p99Idx] ?? 0,
    throughputEpsPerSec: wallTimeMs > 0 ? (totalMeasurements / wallTimeMs) * 1000 : 0,
    graphNodesVisitedP50: perEpisodeGraphNodes[gnP50Idx] ?? 0,
    graphNodesVisitedP95: perEpisodeGraphNodes[gnP95Idx] ?? 0,
    totalEpisodes: episodes.length,
    wallTimeMs,
  };

  return {
    metrics,
    perEpisodeLatencyUs,
    perEpisodeGraphNodes,
  };
}
