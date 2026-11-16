#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// Script: run_main_experiments
//
// Runs Delta V3 and baselines B0–B4 on the benchmark.
// Outputs per-episode predictions, aggregate metrics, and CIs.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import type { Benchmark, BaselineRunResult, ComparisonResult, ExperimentConfig } from "../types";
import { OUTPUT_PATHS, getRuntimeVersions, getCommitHash, EVAL_CONFIG } from "../config";
import { generateBenchmark } from "../benchmark/generator";
import { exportResults, ensureOutputDir } from "../benchmark/export";
import { evaluateBenchmark } from "../delta/adapter";
import { computeAllMetrics, extractPerEpisodeMetricValues } from "../metrics";
import { BASELINES } from "../baselines";
import { computeStatisticalTests } from "../stats";
import { enrichWithCI } from "../stats";

function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Groww Delta V3 — Run Main Experiments                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  // Generate or load benchmark
  console.log("Generating benchmark...");
  const benchmark = generateBenchmark({ seed: 42 });
  console.log(`  ${benchmark.episodeCount} episodes, ${benchmark.scenarioCount} scenarios`);
  console.log();

  ensureOutputDir();

  // Experiment config
  const config: ExperimentConfig = {
    experimentId: `main-${Date.now()}`,
    commitHash: getCommitHash(),
    seed: 42,
    benchmarkVersion: benchmark.version,
    benchmarkChecksum: benchmark.checksum,
    runtimeVersions: getRuntimeVersions(),
    baselineIds: BASELINES.map((b) => b.id),
    ablationIds: [],
    bootstrapIterations: EVAL_CONFIG.bootstrapIterations,
  };

  // ── Run Delta V3 ──────────────────────────────────────────────────────
  console.log("Running Delta V3 (full system)...");
  const deltaPredictions = evaluateBenchmark(benchmark.episodes);
  const deltaMetrics = computeAllMetrics(deltaPredictions, benchmark.episodes);

  // Enrich with CIs using proper per-episode metric values
  const deltaPerEpisode = extractPerEpisodeMetricValues(deltaPredictions, benchmark.episodes);
  deltaMetrics.ndcgAt5 = enrichWithCI(deltaMetrics.ndcgAt5, deltaPerEpisode.ndcgAt5);
  deltaMetrics.precisionAt5 = enrichWithCI(deltaMetrics.precisionAt5, deltaPerEpisode.precisionAt5);
  deltaMetrics.recallAt5 = enrichWithCI(deltaMetrics.recallAt5, deltaPerEpisode.recallAt5);
  deltaMetrics.mrr = enrichWithCI(deltaMetrics.mrr, deltaPerEpisode.mrr);
  deltaMetrics.macroF1 = enrichWithCI(deltaMetrics.macroF1, deltaPerEpisode.macroF1);

  console.log(`  NDCG@5: ${deltaMetrics.ndcgAt5.value.toFixed(3)} ${deltaMetrics.ndcgAt5.ci95 ? `CI: [${deltaMetrics.ndcgAt5.ci95[0].toFixed(3)}, ${deltaMetrics.ndcgAt5.ci95[1].toFixed(3)}]` : ""}`);
  console.log(`  Precision@5: ${deltaMetrics.precisionAt5.value.toFixed(3)}`);
  console.log(`  Recall@5: ${deltaMetrics.recallAt5.value.toFixed(3)}`);
  console.log(`  MRR: ${deltaMetrics.mrr.value.toFixed(3)}`);
  console.log(`  Macro-F1: ${deltaMetrics.macroF1.value.toFixed(3)}`);
  console.log();

  const deltaResult: BaselineRunResult = {
    baselineId: "delta-v3",
    predictions: deltaPredictions,
    metrics: deltaMetrics,
  };

  // ── Run Baselines ─────────────────────────────────────────────────────
  const baselineResults: BaselineRunResult[] = [];

  for (const baseline of BASELINES) {
    console.log(`Running ${baseline.id}...`);
    const predictions = baseline.predict(benchmark);
    const metrics = computeAllMetrics(predictions, benchmark.episodes);
    baselineResults.push({ baselineId: baseline.id, predictions, metrics });
    console.log(`  NDCG@5: ${metrics.ndcgAt5.value.toFixed(3)}`);
  }
  console.log();

  // ── Statistical Comparisons ───────────────────────────────────────────
  console.log("Computing statistical tests (Delta V3 vs each baseline)...");
  const comparisons: ComparisonResult[] = [];

  for (const br of baselineResults) {
    // Build per-episode metric arrays for statistical tests
    const metricsA = extractPerEpisodeMetricValues(deltaPredictions, benchmark.episodes);
    const metricsB = extractPerEpisodeMetricValues(br.predictions, benchmark.episodes);

    const tests = computeStatisticalTests(
      metricsA,
      metricsB,
      "delta-v3",
      br.baselineId,
    );

    const metricDeltas: Record<string, number> = {};
    for (const key of Object.keys(deltaMetrics) as Array<keyof typeof deltaMetrics>) {
      metricDeltas[key] = deltaMetrics[key].value - br.metrics[key].value;
    }

    comparisons.push({
      baselineA: "delta-v3",
      baselineB: br.baselineId,
      metricDeltas,
      tests,
    });

    const sigTests = tests.filter((t) => t.significantAfterHolm);
    console.log(`  vs ${br.baselineId}: ${sigTests.length}/${tests.length} significant`);
  }
  console.log();

  // ── Export Results ─────────────────────────────────────────────────────
  const mainResults = {
    config,
    timestamp: new Date().toISOString(),
    deltaResult,
    baselineResults,
    comparisons,
  };

  exportResults(mainResults, "main-experiment-results.json");

  // Per-episode predictions
  exportResults(deltaPredictions, "delta-v3-predictions.json");
  for (const br of baselineResults) {
    exportResults(br.predictions, `${br.baselineId}-predictions.json`);
  }

  console.log("✅ Results exported to research-output/");
  console.log();
  console.log("Done!");
}

main();
