#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// Script: run_scale
//
// Measures p50/p95 latency, throughput, and graph nodes visited.
// ─────────────────────────────────────────────────────────────────────────────

import { generateBenchmark } from "../benchmark/generator";
import { exportResults, ensureOutputDir } from "../benchmark/export";
import { runScaleBenchmark } from "../scale";

function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Groww Delta V3 — Run Scale Benchmark                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  console.log("Generating benchmark...");
  const benchmark = generateBenchmark({ seed: 42 });
  console.log(`  ${benchmark.episodeCount} episodes`);
  console.log();

  ensureOutputDir();

  console.log("Running scale benchmark (with warm-up)...");
  const result = runScaleBenchmark(benchmark.episodes);
  const m = result.metrics;

  console.log();
  console.log("Results:");
  console.log(`  p50 Latency:  ${m.p50LatencyUs.toFixed(1)} μs`);
  console.log(`  p95 Latency:  ${m.p95LatencyUs.toFixed(1)} μs`);
  console.log(`  p99 Latency:  ${m.p99LatencyUs.toFixed(1)} μs`);
  console.log(`  Throughput:   ${m.throughputEpsPerSec.toFixed(0)} episodes/sec`);
  console.log(`  Graph Nodes (p50): ${m.graphNodesVisitedP50}`);
  console.log(`  Graph Nodes (p95): ${m.graphNodesVisitedP95}`);
  console.log(`  Wall Time:    ${(m.wallTimeMs / 1000).toFixed(1)}s`);
  console.log();

  exportResults({
    timestamp: new Date().toISOString(),
    metrics: m,
    perEpisodeLatencyUs: result.perEpisodeLatencyUs,
    perEpisodeGraphNodes: result.perEpisodeGraphNodes,
  }, "scale-results.json");

  console.log("✅ Scale results exported to research-output/scale-results.json");
  console.log("Done!");
}

main();
