#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// Script: build_controlled_benchmark
//
// Generates the controlled benchmark with 300 episodes across 40 scenarios.
// Outputs: research-output/benchmark.json, research-output/benchmark-manifest.json
// ─────────────────────────────────────────────────────────────────────────────

import { generateBenchmark } from "../benchmark/generator";
import { exportBenchmark } from "../benchmark/export";
import { validateBenchmark } from "../benchmark/validate";
import { BENCHMARK_CONFIG } from "../config";

function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Groww Delta V3 — Build Controlled Benchmark           ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`Target: ${BENCHMARK_CONFIG.targetEpisodes} episodes across ${BENCHMARK_CONFIG.targetScenarios} scenarios`);
  console.log(`Seed: 42 (deterministic)`);
  console.log();

  // Generate
  console.log("Generating benchmark...");
  const benchmark = generateBenchmark({ seed: 42, targetEpisodes: BENCHMARK_CONFIG.targetEpisodes });
  console.log(`  Generated ${benchmark.episodeCount} episodes across ${benchmark.scenarioCount} scenarios`);
  console.log(`  Checksum: ${benchmark.checksum}`);
  console.log();

  // Category distribution
  console.log("Category distribution:");
  for (const [cat, count] of Object.entries(benchmark.scenarioCategories)) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log();

  // Validate
  console.log("Validating benchmark...");
  const validation = validateBenchmark(benchmark);
  if (validation.valid) {
    console.log("  ✓ Benchmark is valid");
  } else {
    console.log("  ✗ Validation errors:");
    for (const err of validation.errors) {
      console.log(`    - ${err}`);
    }
    process.exit(1);
  }

  if (validation.warnings.length > 0) {
    console.log("  Warnings:");
    for (const warn of validation.warnings) {
      console.log(`    ⚠ ${warn}`);
    }
  }
  console.log();

  // Stats
  console.log("Stats:");
  console.log(`  Episodes: ${validation.stats.episodeCount}`);
  console.log(`  Scenarios: ${validation.stats.scenarioCount}`);
  console.log(`  Avg snapshots/episode: ${validation.stats.avgSnapshotsPerEpisode.toFixed(1)}`);
  console.log(`  Avg events/episode: ${validation.stats.avgEventsPerEpisode.toFixed(1)}`);
  console.log(`  Gold relevant rate: ${(validation.stats.goldRelevantRate * 100).toFixed(1)}%`);
  console.log(`  Lane distribution:`, validation.stats.laneDistribution);
  console.log();

  // Export
  console.log("Exporting benchmark...");
  exportBenchmark(benchmark);
  console.log("  ✓ Exported to research-output/benchmark.json");
  console.log("  ✓ Exported to research-output/benchmark-manifest.json");
  console.log();

  console.log("Done!");
}

main();
