// ─────────────────────────────────────────────────────────────────────────────
// Statistical Analysis
//
// Implements:
// - Paired bootstrap 95% confidence intervals
// - Cohen's d effect sizes
// - Optional Wilcoxon signed-rank test
// - Holm-Bonferroni correction for multiple comparisons
// ─────────────────────────────────────────────────────────────────────────────

import type { MetricResult, StatisticalTest } from "../types";
import { EVAL_CONFIG } from "../config";

// ── Seeded PRNG for reproducible bootstrapping ──────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Paired Bootstrap CI ─────────────────────────────────────────────────────

/**
 * Compute paired bootstrap 95% confidence interval for a metric.
 *
 * @param valuesA - Per-episode metric values for system A
 * @param valuesB - Per-episode metric values for system B
 * @param metricFn - Function that computes aggregate metric from paired values
 * @param iterations - Number of bootstrap resamples
 */
export function pairedBootstrapCI(
  valuesA: number[],
  valuesB: number[],
  metricFn: (a: number[], b: number[]) => number,
  iterations: number = EVAL_CONFIG.bootstrapIterations,
  seed: number = 42,
): { ci95: [number, number]; se: number; pointEstimate: number } {
  const n = valuesA.length;
  if (n === 0) return { ci95: [0, 0], se: 0, pointEstimate: 0 };

  const rng = mulberry32(seed);
  const pointEstimate = metricFn(valuesA, valuesB);
  const bootstrapValues: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Resample with replacement
    const indices: number[] = [];
    for (let j = 0; j < n; j++) {
      indices.push(Math.floor(rng() * n));
    }

    const sampleA = indices.map((idx) => valuesA[idx]);
    const sampleB = indices.map((idx) => valuesB[idx]);
    bootstrapValues.push(metricFn(sampleA, sampleB));
  }

  bootstrapValues.sort((a, b) => a - b);

  const alpha = 1 - EVAL_CONFIG.confidenceLevel;
  const lowerIdx = Math.floor(alpha / 2 * iterations);
  const upperIdx = Math.floor((1 - alpha / 2) * iterations) - 1;

  const ci95: [number, number] = [
    bootstrapValues[lowerIdx],
    bootstrapValues[upperIdx],
  ];

  // Standard error from bootstrap distribution
  const mean = bootstrapValues.reduce((a, b) => a + b, 0) / iterations;
  const variance = bootstrapValues.reduce((a, b) => a + (b - mean) ** 2, 0) / (iterations - 1);
  const se = Math.sqrt(variance);

  return { ci95, se, pointEstimate };
}

/**
 * Bootstrap CI for a single metric (not paired).
 */
export function bootstrapCI(
  values: number[],
  metricFn: (sample: number[]) => number,
  iterations: number = EVAL_CONFIG.bootstrapIterations,
  seed: number = 42,
): { ci95: [number, number]; se: number; pointEstimate: number } {
  const n = values.length;
  if (n === 0) return { ci95: [0, 0], se: 0, pointEstimate: 0 };

  const rng = mulberry32(seed);
  const pointEstimate = metricFn(values);
  const bootstrapValues: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const sample: number[] = [];
    for (let j = 0; j < n; j++) {
      sample.push(values[Math.floor(rng() * n)]);
    }
    bootstrapValues.push(metricFn(sample));
  }

  bootstrapValues.sort((a, b) => a - b);

  const alpha = 1 - EVAL_CONFIG.confidenceLevel;
  const lowerIdx = Math.floor(alpha / 2 * iterations);
  const upperIdx = Math.floor((1 - alpha / 2) * iterations) - 1;

  const ci95: [number, number] = [
    bootstrapValues[lowerIdx],
    bootstrapValues[upperIdx],
  ];

  const mean = bootstrapValues.reduce((a, b) => a + b, 0) / iterations;
  const variance = bootstrapValues.reduce((a, b) => a + (b - mean) ** 2, 0) / (iterations - 1);
  const se = Math.sqrt(variance);

  return { ci95, se, pointEstimate };
}

// ── Effect Size (Cohen's d) ─────────────────────────────────────────────────

/**
 * Cohen's d for paired samples.
 * d = mean(diff) / std(diff)
 */
export function cohensD(valuesA: number[], valuesB: number[]): number {
  if (valuesA.length !== valuesB.length || valuesA.length === 0) return 0;

  const diffs = valuesA.map((a, i) => a - valuesB[i]);
  const n = diffs.length;
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const variance = diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);

  return std > 0 ? mean / std : 0;
}

/**
 * Interpret effect size magnitude.
 */
export function interpretEffectSize(d: number): string {
  const absD = Math.abs(d);
  if (absD < 0.2) return "negligible";
  if (absD < 0.5) return "small";
  if (absD < 0.8) return "medium";
  return "large";
}

// ── Wilcoxon Signed-Rank Test ───────────────────────────────────────────────

/**
 * Wilcoxon signed-rank test for paired samples.
 * Tests whether the median difference is significantly different from zero.
 *
 * Returns the test statistic W and approximate p-value.
 */
export function wilcoxonSignedRank(
  valuesA: number[],
  valuesB: number[],
): { statistic: number; pValue: number } {
  if (valuesA.length !== valuesB.length || valuesA.length < 5) {
    return { statistic: 0, pValue: 1 };
  }

  const diffs = valuesA.map((a, i) => a - valuesB[i]);

  // Remove zero differences
  const nonZero = diffs.filter((d) => d !== 0);
  if (nonZero.length === 0) return { statistic: 0, pValue: 1 };

  // Rank absolute differences
  const absDiffs = nonZero.map((d) => Math.abs(d));
  const sorted = [...absDiffs].sort((a, b) => a - b);
  const ranks = absDiffs.map((d) => {
    const idx = sorted.indexOf(d);
    return idx + 1;
  });

  // Sum of positive ranks
  let wPlus = 0;
  for (let i = 0; i < nonZero.length; i++) {
    if (nonZero[i] > 0) wPlus += ranks[i];
  }

  const n = nonZero.length;
  const wMinus = (n * (n + 1)) / 2 - wPlus;
  const W = Math.min(wPlus, wMinus);

  // Normal approximation for p-value
  const mu = (n * (n + 1)) / 4;
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
  const z = (W - mu) / sigma;

  // Two-tailed p-value from standard normal
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return { statistic: W, pValue: Math.max(0, Math.min(1, pValue)) };
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}

// ── Holm-Bonferroni Correction ──────────────────────────────────────────────

/**
 * Apply Holm-Bonferroni correction for multiple comparisons.
 *
 * @param tests - Array of { name, pValue } pairs
 * @param alpha - Family-wise significance level (default 0.05)
 * @returns Tests with corrected significance flags
 */
export function holmCorrection(
  tests: Array<{ name: string; pValue: number }>,
  alpha: number = 0.05,
): Array<{ name: string; pValue: number; significant: boolean; adjustedAlpha: number }> {
  const sorted = [...tests].sort((a, b) => a.pValue - b.pValue);
  const m = sorted.length;

  return sorted.map((test, idx) => {
    const adjustedAlpha = alpha / (m - idx);
    return {
      name: test.name,
      pValue: test.pValue,
      significant: test.pValue <= adjustedAlpha,
      adjustedAlpha,
    };
  });
}

// ── Enrich MetricResult with CIs ────────────────────────────────────────────

/**
 * Add bootstrap CI to a MetricResult using per-episode values.
 */
export function enrichWithCI(
  result: MetricResult,
  perEpisodeValues: number[],
  seed: number = 42,
): MetricResult {
  const { ci95, se } = bootstrapCI(perEpisodeValues, (vals) => {
    const sum = vals.reduce((a, b) => a + b, 0);
    return vals.length > 0 ? sum / vals.length : 0;
  }, EVAL_CONFIG.bootstrapIterations, seed);

  return { ...result, ci95, se };
}

// ── Compute all statistical tests between two systems ───────────────────────

export interface PerEpisodeMetricValues {
  ndcgAt5: number[];
  precisionAt5: number[];
  recallAt5: number[];
  mrr: number[];
  macroF1: number[];
}

export function computeStatisticalTests(
  valuesA: PerEpisodeMetricValues,
  valuesB: PerEpisodeMetricValues,
  labelA: string,
  labelB: string,
): StatisticalTest[] {
  const metrics: Array<keyof PerEpisodeMetricValues> = [
    "ndcgAt5", "precisionAt5", "recallAt5", "mrr", "macroF1",
  ];

  const tests: StatisticalTest[] = [];

  for (const metric of metrics) {
    const a = valuesA[metric];
    const b = valuesB[metric];
    if (a.length === 0 || b.length === 0) continue;

    // Effect size
    const d = cohensD(a, b);

    // Wilcoxon
    const { pValue } = wilcoxonSignedRank(a, b);

    tests.push({
      testName: `${metric} (${labelA} vs ${labelB})`,
      statistic: d,
      pValue,
      effectSize: d,
      effectSizeMeasure: "Cohen's d",
      significantAfterHolm: false, // Filled in after correction
      holmAdjustedAlpha: 0,
    });
  }

  // Apply Holm correction
  const corrected = holmCorrection(
    tests.map((t) => ({ name: t.testName, pValue: t.pValue })),
  );

  for (let i = 0; i < tests.length; i++) {
    tests[i].significantAfterHolm = corrected[i].significant;
    tests[i].holmAdjustedAlpha = corrected[i].adjustedAlpha;
  }

  return tests;
}
