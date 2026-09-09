#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// Script: export_paper_tables
//
// Generates LaTeX and Markdown tables from the experiment results.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { generateBenchmark } from "../benchmark/generator";
import { evaluateBenchmark } from "../delta/adapter";
import { computeAllMetrics, extractPerEpisodeMetricValues } from "../metrics";
import { BASELINES } from "../baselines";
import { runAllAblations } from "../ablations";
import { runScaleBenchmark } from "../scale";
import { exportPaperTables } from "../export-paper-tables";
import { computeStatisticalTests } from "../stats";
import type { BaselineRunResult, ComparisonResult } from "../types";
import { ensureOutputDir } from "../benchmark/export";

function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Groww Delta V3 — Export Paper Tables                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  ensureOutputDir();

  // Generate benchmark
  console.log("Generating benchmark...");
  const benchmark = generateBenchmark({ seed: 42 });
  console.log(`  ${benchmark.episodeCount} episodes`);

  // Delta V3
  console.log("Running Delta V3...");
  const deltaPredictions = evaluateBenchmark(benchmark.episodes);
  const deltaMetrics = computeAllMetrics(deltaPredictions, benchmark.episodes);
  const deltaResult: BaselineRunResult = {
    baselineId: "delta-v3",
    predictions: deltaPredictions,
    metrics: deltaMetrics,
  };

  // Baselines
  console.log("Running baselines...");
  const baselineResults: BaselineRunResult[] = BASELINES.map((baseline) => {
    const predictions = baseline.predict(benchmark);
    const metrics = computeAllMetrics(predictions, benchmark.episodes);
    return { baselineId: baseline.id, predictions, metrics };
  });

  // Ablations
  console.log("Running ablations...");
  const ablationResults = runAllAblations(benchmark.episodes);

  // Statistical comparisons
  console.log("Computing statistical tests...");
  const deltaPerEp = extractPerEpisodeMetricValues(deltaPredictions, benchmark.episodes);
  const comparisons: ComparisonResult[] = baselineResults.map((br) => {
    const brPerEp = extractPerEpisodeMetricValues(br.predictions, benchmark.episodes);
    const tests = computeStatisticalTests(deltaPerEp, brPerEp, "delta-v3", br.baselineId);
    return {
      baselineA: "delta-v3",
      baselineB: br.baselineId,
      metricDeltas: {},
      tests,
    };
  });

  // Scale
  console.log("Running scale benchmark...");
  const scaleResult = runScaleBenchmark(benchmark.episodes);

  // Export
  console.log("Exporting tables...");
  exportPaperTables({
    deltaResult,
    baselineResults,
    ablationResults,
    comparisons,
    scaleMetrics: scaleResult.metrics,
  });

  console.log("✅ Paper tables exported to research-output/paper-tables.tex and paper-tables.md");
  console.log("Done!");
}

main();
