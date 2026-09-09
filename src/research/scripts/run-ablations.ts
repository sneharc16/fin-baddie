#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// Script: run_ablations
//
// Runs all ablation configurations against the benchmark.
// ─────────────────────────────────────────────────────────────────────────────

import { generateBenchmark } from "../benchmark/generator";
import { exportResults, ensureOutputDir } from "../benchmark/export";
import { evaluateBenchmark } from "../delta/adapter";
import { computeAllMetrics, computeSubsetMetrics } from "../metrics";
import { runAllAblations } from "../ablations";

function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Groww Delta V3 — Run Ablations                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  console.log("Generating benchmark...");
  const benchmark = generateBenchmark({ seed: 42 });
  console.log(`  ${benchmark.episodeCount} episodes`);
  console.log();

  ensureOutputDir();

  // Run full Delta V3 first
  console.log("Running Delta V3 (full)...");
  const deltaPredictions = evaluateBenchmark(benchmark.episodes);
  const deltaMetrics = computeAllMetrics(deltaPredictions, benchmark.episodes);
  console.log(`  NDCG@5: ${deltaMetrics.ndcgAt5.value.toFixed(3)}`);
  console.log();

  // Run ablations
  console.log("Running ablations...");
  const ablationResults = runAllAblations(benchmark.episodes);

  for (const ar of ablationResults) {
    const m = ar.metrics;
    console.log(`  ${ar.variantName}:`);
    console.log(`    NDCG@5: ${m.ndcgAt5.value.toFixed(3)} (Δ: ${(m.ndcgAt5.value - deltaMetrics.ndcgAt5.value).toFixed(3)})`);
    console.log(`    Precision@5: ${m.precisionAt5.value.toFixed(3)}`);
    console.log(`    Recall@5: ${m.recallAt5.value.toFixed(3)}`);
    console.log(`    MRR: ${m.mrr.value.toFixed(3)}`);
    console.log(`    Macro-F1: ${m.macroF1.value.toFixed(3)}`);
  }
  console.log();

  // ── Graph-only subset analysis ───────────────────────────────────────
  console.log("Graph-only subset analysis:");
  const hasGraph = (ep: typeof benchmark.episodes[0]) => ep.graphs.length > 0;
  const deltaGraphSubset = computeSubsetMetrics(deltaPredictions, benchmark.episodes, hasGraph);
  console.log(`  Delta V3 (graph-only): NDCG@5 = ${deltaGraphSubset.ndcgAt5.value.toFixed(3)}`);

  const graphAblation = ablationResults.find((ar) => ar.ablationId === "abl-graph");
  if (graphAblation) {
    const graphSubMetrics = computeSubsetMetrics(graphAblation.predictions, benchmark.episodes, hasGraph);
    console.log(`  −Graph (graph-only):   NDCG@5 = ${graphSubMetrics.ndcgAt5.value.toFixed(3)}`);
    console.log(`  Δ on graph subset:     ${(graphSubMetrics.ndcgAt5.value - deltaGraphSubset.ndcgAt5.value).toFixed(3)}`);
  }
  console.log();

  // Export
  exportResults({
    timestamp: new Date().toISOString(),
    deltaMetrics,
    ablationResults,
  }, "ablation-results.json");

  console.log("✅ Ablation results exported to research-output/ablation-results.json");
  console.log("Done!");
}

main();
