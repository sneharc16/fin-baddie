// ─────────────────────────────────────────────────────────────────────────────
// Benchmark: Independent Gold Label Generator
//
// CRITICAL: Gold labels are NEVER derived from Delta's outputs.
// They are generated from domain-expert rules applied independently.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  EpisodeGoldLabels,
  GoldLabelConfig,
  ScenarioDefinition,
} from "../types";
import type { AttentionLane } from "@/domain/attention/types";

/**
 * Generate gold labels for an episode from the scenario's gold configuration.
 *
 * Gold labels encode domain-expert judgments about what SHOULD be surfaced,
 * independent of what Delta actually surfaces. They are based on:
 *
 * 1. Whether a directly matching event fired for an active intent
 * 2. Whether graph traversal would find a relevant path
 * 3. Whether objective significance thresholds are crossed
 * 4. Temporal decay of relevance over evaluation steps
 *
 * The gold config is defined per scenario by the benchmark author, not computed
 * from any system output.
 */
export function generateGoldLabels(
  scenario: ScenarioDefinition,
  evalStep: number,
): EpisodeGoldLabels {
  const gold = scenario.goldConfig;

  // Find the closest step in the gold config
  const availableSteps = Object.keys(gold.stepRelevance)
    .map(Number)
    .sort((a, b) => a - b);

  // Binary relevance: derived from the authoritative relevantSteps list,
  // NOT from stepRelevance values (which may have minor non-zero values
  // for non-relevant steps).
  const relevantStepSet = new Set(gold.relevantSteps);
  const binaryRelevance: Record<number, boolean> = {};
  for (const step of Object.keys(gold.stepRelevance).map(Number)) {
    binaryRelevance[step] = relevantStepSet.has(step);
  }

  // Determine lane for the eval step
  const evalRelevance = gold.stepRelevance[evalStep] ?? 0;
  const lane = gold.stepLane[evalStep] ?? classifyGoldLane(evalRelevance, scenario);

  // Rationale: accumulate from all active steps
  const activeRationales = Object.entries(gold.rationale)
    .filter(([step]) => Number(step) <= evalStep && gold.stepRelevance[Number(step)] > 0)
    .map(([, r]) => r);
  const rationale = activeRationales.length > 0
    ? activeRationales[activeRationales.length - 1]
    : gold.rationale[evalStep] ?? "No relevant activity.";

  return {
    stepRelevance: gold.stepRelevance,
    binaryRelevance,
    lane,
    rationale,
  };
}

/**
 * Classify gold lane independently from Delta's classification.
 * Uses the same domain rules but applied to gold relevance, not system output.
 */
function classifyGoldLane(
  goldRelevance: number,
  _scenario: ScenarioDefinition,
): AttentionLane {
  // Gold lane rules mirror the domain logic but use gold relevance scores
  if (goldRelevance > 0) return "RELEVANT";
  // For SIGNIFICANT, we'd need gold significance — default to QUIET if no relevance
  return "QUIET";
}

/**
 * Validate that gold labels are well-formed and internally consistent.
 */
export function validateGoldLabels(
  labels: EpisodeGoldLabels,
  scenario: ScenarioDefinition,
): string[] {
  const errors: string[] = [];

  // Check that binary relevance is consistent with step relevance
  // Note: stepRelevance can be > 0 while binaryRelevance is false.
  // This is by design — stepRelevance encodes continuous importance scores
  // while binaryRelevance encodes the authoritative relevant/not-relevant decision.
  // Binary relevance is derived from the curated relevantSteps list, not from stepRelevance values.
  for (const [step, rel] of Object.entries(labels.stepRelevance)) {
    const binary = labels.binaryRelevance[Number(step)];
    if (rel === 0 && binary !== false) {
      errors.push(`Step ${step}: relevance 0 but binary is not false`);
    }
  }

  // Check that relevant steps in config match binary relevance
  const configRelevant = new Set(scenario.goldConfig.relevantSteps);
  for (const [step, binary] of Object.entries(labels.binaryRelevance)) {
    if (binary && !configRelevant.has(Number(step))) {
      errors.push(`Step ${step}: binary relevant but not in scenario relevantSteps`);
    }
  }

  // Lane must be one of the valid values
  if (!["RELEVANT", "SIGNIFICANT", "QUIET"].includes(labels.lane)) {
    errors.push(`Invalid lane: ${labels.lane}`);
  }

  return errors;
}

/**
 * Compute the number of truly relevant items in gold for recall normalization.
 */
export function countGoldRelevant(labels: EpisodeGoldLabels): number {
  return Object.values(labels.binaryRelevance).filter(Boolean).length;
}

/**
 * Get gold-relevant step indices for an episode.
 */
export function getGoldRelevantSteps(labels: EpisodeGoldLabels): number[] {
  return Object.entries(labels.binaryRelevance)
    .filter(([, v]) => v)
    .map(([k]) => Number(k));
}
