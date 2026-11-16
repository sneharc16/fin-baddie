#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// Script: validate_benchmark
//
// Validates an existing benchmark file for:
// - Structural integrity
// - Temporal ordering
// - Gold label independence
// - Benchmark leakage / temporal validation
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { validateBenchmark, checkTemporalLeakage } from "../benchmark/validate";
import type { Benchmark } from "../types";
import { OUTPUT_PATHS } from "../config";

function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Groww Delta V3 — Validate Benchmark                   ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  // Load benchmark
  let benchmark: Benchmark;
  try {
    const raw = readFileSync(OUTPUT_PATHS.benchmark, "utf-8");
    benchmark = JSON.parse(raw) as Benchmark;
    console.log(`Loaded benchmark: ${benchmark.version} (${benchmark.episodeCount} episodes)`);
  } catch (err) {
    console.error("Failed to load benchmark. Run build_controlled_benchmark first.");
    console.error(err);
    process.exit(1);
  }
  console.log();

  // Structural validation
  console.log("Running structural validation...");
  const validation = validateBenchmark(benchmark);
  if (validation.valid) {
    console.log("  ✓ Structural validation passed");
  } else {
    console.log("  ✗ Structural validation failed:");
    for (const err of validation.errors) {
      console.log(`    - ${err}`);
    }
  }

  if (validation.warnings.length > 0) {
    console.log("  Warnings:");
    for (const warn of validation.warnings) {
      console.log(`    ⚠ ${warn}`);
    }
  }
  console.log();

  // Temporal leakage check
  console.log("Checking temporal leakage...");
  const leakageIssues = checkTemporalLeakage(benchmark);
  if (leakageIssues.length === 0) {
    console.log("  ✓ No temporal leakage detected");
  } else {
    console.log("  ✗ Temporal leakage found:");
    for (const issue of leakageIssues) {
      console.log(`    - ${issue}`);
    }
  }
  console.log();

  // Summary
  console.log("Summary:");
  console.log(`  Episodes: ${validation.stats.episodeCount}`);
  console.log(`  Scenarios: ${validation.stats.scenarioCount}`);
  console.log(`  Category distribution:`, validation.stats.categoryDistribution);
  console.log(`  Lane distribution:`, validation.stats.laneDistribution);
  console.log(`  Gold relevant rate: ${(validation.stats.goldRelevantRate * 100).toFixed(1)}%`);
  console.log();

  if (!validation.valid || leakageIssues.length > 0) {
    console.log("❌ Benchmark validation FAILED");
    process.exit(1);
  } else {
    console.log("✅ Benchmark validation PASSED");
  }
}

main();
