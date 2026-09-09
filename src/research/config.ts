// ─────────────────────────────────────────────────────────────────────────────
// Groww Delta V3 → AIST 2026 Research: Configuration & Constants
// ─────────────────────────────────────────────────────────────────────────────

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// ── V3 Production Constants (FROZEN — do not modify) ───────────────────────

export const V3_WEIGHTS = {
  significance: 0.30,
  relevance: 0.35,
  novelty: 0.15,
  urgency: 0.10,
  confidence: 0.10,
} as const;

export const V3_LANE_RULES = {
  relevantThreshold: 0, // relevance > 0 → RELEVANT
  significantThreshold: 50, // significance >= 50 → SIGNIFICANT
} as const;

export const V3_GRAPH_BOUNDS = {
  maxDepth: 3,
  maxVisitedNodes: 25,
} as const;

export const V3_MIN_GRAPH_RELEVANCE = 50;

// ── Benchmark Configuration ─────────────────────────────────────────────────

export const BENCHMARK_CONFIG = {
  /** Target number of episodes */
  targetEpisodes: 300,
  /** Target number of distinct scenarios */
  targetScenarios: 40,
  /** Min episodes per scenario category */
  minEpisodesPerCategory: 30,
  /** Evaluation window: how many steps after cursor */
  evalWindowSteps: 5,
  /** Benchmark version (increment when schema changes) */
  version: "1.0.0",
} as const;

// ── Evaluation Configuration ────────────────────────────────────────────────

export const EVAL_CONFIG = {
  /** Top-k for precision/recall/DCG */
  k: 5,
  /** Bootstrap iterations for CIs */
  bootstrapIterations: 10000,
  /** Confidence level */
  confidenceLevel: 0.95,
  /** Random seed for reproducibility */
  defaultSeed: 42,
} as const;

// ── Latency Measurement ─────────────────────────────────────────────────────

export const SCALE_CONFIG = {
  /** Warm-up iterations (discarded) */
  warmupIterations: 50,
  /** Measured iterations */
  measuredIterations: 500,
} as const;

// ── Runtime Metadata ────────────────────────────────────────────────────────

export function getCommitHash(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function getRuntimeVersions() {
  return {
    nodeVersion: process.version,
    typescriptVersion: "6.0.3", // from devDependencies
    projectVersion: getPackageVersion(),
  };
}

// ── Output Paths ────────────────────────────────────────────────────────────

export const OUTPUT_DIR = "research-output";

export const OUTPUT_PATHS = {
  benchmark: `${OUTPUT_DIR}/benchmark.json`,
  benchmarkManifest: `${OUTPUT_DIR}/benchmark-manifest.json`,
  mainResults: `${OUTPUT_DIR}/main-experiment-results.json`,
  ablationResults: `${OUTPUT_DIR}/ablation-results.json`,
  scaleResults: `${OUTPUT_DIR}/scale-results.json`,
  paperTables: `${OUTPUT_DIR}/paper-tables`,
} as const;
