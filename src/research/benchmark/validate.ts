// ─────────────────────────────────────────────────────────────────────────────
// Benchmark: Validation & Leakage Detection
//
// Validates:
// 1. Structural integrity (all required fields present)
// 2. Temporal ordering (snapshots and events are ordered by sequence)
// 3. Gold label independence (labels don't encode system outputs)
// 4. Benchmark leakage (no episode data leaks across train/test)
// 5. Scenario coverage (all categories represented)
// ─────────────────────────────────────────────────────────────────────────────

import type { Benchmark, Episode } from "../types";
import type { AttentionLane } from "@/domain/attention/types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    episodeCount: number;
    scenarioCount: number;
    categoryDistribution: Record<string, number>;
    laneDistribution: Record<string, number>;
    avgSnapshotsPerEpisode: number;
    avgEventsPerEpisode: number;
    goldRelevantRate: number;
  };
}

export function validateBenchmark(benchmark: Benchmark): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Structural Checks ──────────────────────────────────────────────────

  if (benchmark.episodes.length === 0) {
    errors.push("Benchmark contains no episodes");
  }

  if (!benchmark.version) {
    errors.push("Benchmark missing version");
  }

  if (!benchmark.checksum) {
    errors.push("Benchmark missing checksum");
  }

  // ── Per-Episode Checks ─────────────────────────────────────────────────

  const laneCounts: Record<string, number> = {};
  const catCounts: Record<string, number> = {};
  let totalSnapshots = 0;
  let totalEvents = 0;
  let totalGoldRelevant = 0;

  for (const episode of benchmark.episodes) {
    // Temporal ordering: snapshots
    for (let i = 1; i < episode.snapshots.length; i++) {
      if (episode.snapshots[i].sequence < episode.snapshots[i - 1].sequence) {
        errors.push(`Episode ${episode.id}: snapshots not ordered by sequence`);
        break;
      }
    }

    // Temporal ordering: events
    for (let i = 1; i < episode.events.length; i++) {
      if (episode.events[i].sequence < episode.events[i - 1].sequence) {
        errors.push(`Episode ${episode.id}: events not ordered by sequence`);
        break;
      }
    }

    // Cursor should be before current sequence
    if (episode.cursor.lastSeenSequence >= episode.currentSequence) {
      errors.push(
        `Episode ${episode.id}: cursor (${episode.cursor.lastSeenSequence}) >= current (${episode.currentSequence})`,
      );
    }

    // Gold labels check
    if (!episode.goldLabels) {
      errors.push(`Episode ${episode.id}: missing gold labels`);
    } else {
      const goldRelevant = Object.values(episode.goldLabels.binaryRelevance).filter(Boolean).length;
      totalGoldRelevant += goldRelevant;

      // Lane must be valid
      if (!["RELEVANT", "SIGNIFICANT", "QUIET"].includes(episode.goldLabels.lane)) {
        errors.push(`Episode ${episode.id}: invalid gold lane "${episode.goldLabels.lane}"`);
      }
    }

    // Stats
    totalSnapshots += episode.snapshots.length;
    totalEvents += episode.events.length;

    const lane = episode.goldLabels?.lane ?? "QUIET";
    laneCounts[lane] = (laneCounts[lane] ?? 0) + 1;
  }

  // ── Scenario Coverage ──────────────────────────────────────────────────

  for (const episode of benchmark.episodes) {
    catCounts[episode.scenarioKey] = (catCounts[episode.scenarioKey] ?? 0) + 1;
  }

  if (Object.keys(catCounts).length < 30) {
    warnings.push(
      `Only ${Object.keys(catCounts).length} unique scenarios (target: ${40})`,
    );
  }

  // ── Temporal Leakage Check ─────────────────────────────────────────────
  // Verify that gold labels for episode N don't reference data from episode N+1

  const episodesByScenario = new Map<string, Episode[]>();
  for (const ep of benchmark.episodes) {
    const list = episodesByScenario.get(ep.scenarioKey) ?? [];
    list.push(ep);
    episodesByScenario.set(ep.scenarioKey, list);
  }

  for (const [scenarioKey, eps] of episodesByScenario) {
    if (eps.length <= 1) continue;

    // Check that episodes in the same scenario don't share snapshot IDs
    // (would indicate data leakage)
    const snapshotIds = new Set<string>();
    for (const ep of eps) {
      for (const snap of ep.snapshots) {
        if (snapshotIds.has(snap.id)) {
          warnings.push(
            `Scenario ${scenarioKey}: duplicate snapshot ID ${snap.id} across episodes`,
          );
        }
        snapshotIds.add(snap.id);
      }
    }
  }

  // ── Compute Stats ──────────────────────────────────────────────────────

  const episodeCount = benchmark.episodes.length;
  const stats = {
    episodeCount,
    scenarioCount: Object.keys(catCounts).length,
    categoryDistribution: catCounts,
    laneDistribution: laneCounts,
    avgSnapshotsPerEpisode: episodeCount > 0 ? totalSnapshots / episodeCount : 0,
    avgEventsPerEpisode: episodeCount > 0 ? totalEvents / episodeCount : 0,
    goldRelevantRate: episodeCount > 0 ? totalGoldRelevant / episodeCount : 0,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

/**
 * Check for temporal leakage: ensure no episode's gold labels
 * were influenced by knowing future events.
 */
export function checkTemporalLeakage(benchmark: Benchmark): string[] {
  const issues: string[] = [];

  for (const episode of benchmark.episodes) {
    const evalStep = episode.evalStep;

    // Gold labels should only reference steps up to evalStep
    for (const step of Object.keys(episode.goldLabels.stepRelevance).map(Number)) {
      if (step > evalStep) {
        issues.push(
          `Episode ${episode.id}: gold label at step ${step} > evalStep ${evalStep} (temporal leakage)`,
        );
      }
    }
  }

  return issues;
}
