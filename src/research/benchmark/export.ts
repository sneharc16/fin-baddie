// ─────────────────────────────────────────────────────────────────────────────
// Benchmark: Export Utilities
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from "node:fs";
import type { Benchmark, BenchmarkManifest } from "../types";
import { OUTPUT_DIR, OUTPUT_PATHS } from "../config";

/** JSON.stringify replacer that converts BigInt to string */
function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function ensureOutputDir(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

export function exportBenchmark(benchmark: Benchmark): void {
  ensureOutputDir();
  writeFileSync(OUTPUT_PATHS.benchmark, JSON.stringify(benchmark, bigintReplacer, 2));

  const manifest: BenchmarkManifest = {
    version: benchmark.version,
    checksum: benchmark.checksum,
    episodeCount: benchmark.episodeCount,
    scenarioCount: benchmark.scenarioCount,
    createdAt: benchmark.createdAt,
  };
  writeFileSync(OUTPUT_PATHS.benchmarkManifest, JSON.stringify(manifest, bigintReplacer, 2));
}

export function exportEpisodePredictions(
  predictions: unknown[],
  filename: string,
): void {
  ensureOutputDir();
  const path = `${OUTPUT_DIR}/${filename}`;
  writeFileSync(path, JSON.stringify(predictions, bigintReplacer, 2));
}

export function exportResults(
  results: unknown,
  filename: string,
): void {
  ensureOutputDir();
  const path = `${OUTPUT_DIR}/${filename}`;
  writeFileSync(path, JSON.stringify(results, bigintReplacer, 2));
}
