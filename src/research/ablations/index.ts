// ─────────────────────────────────────────────────────────────────────────────
// Ablation Configurations & Runner
//
// Implements all required ablations:
// - ΔCursor (disable Knowledge Cursor)
// - ΔGraph (disable graph traversal)
// - ΔSignificance (zero out significance component)
// - ΔUrgency (zero out urgency component)
// - ΔConfidence (zero out confidence component)
// - Equal Weights (uniform 20% per component)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AblationConfig,
  AblationRunResult,
  Episode,
  EpisodePrediction,
} from "../types";
import type { KnowledgeCursorRecord } from "@/domain/market/types";
import { evaluateEpisode } from "../delta/adapter";
import { computeAllMetrics } from "../metrics";

// ── Ablation Definitions ────────────────────────────────────────────────────

export const ABLATION_CONFIGS: AblationConfig[] = [
  {
    id: "abl-cursor",
    name: "−Cursor",
    description: "Disable Knowledge Cursor — always evaluate from sequence 0.",
    weightOverrides: {},
    disableComponents: [],
    disableCursor: true,
    disableGraph: false,
    equalWeights: false,
  },
  {
    id: "abl-graph",
    name: "−Graph",
    description: "Disable graph traversal — only direct intent matches.",
    weightOverrides: {},
    disableComponents: [],
    disableCursor: false,
    disableGraph: true,
    equalWeights: false,
  },
  {
    id: "abl-significance",
    name: "−Significance",
    description: "Zero out the significance component in scoring.",
    weightOverrides: {},
    disableComponents: ["significance"],
    disableCursor: false,
    disableGraph: false,
    equalWeights: false,
  },
  {
    id: "abl-urgency",
    name: "−Urgency",
    description: "Zero out the urgency component in scoring.",
    weightOverrides: {},
    disableComponents: ["urgency"],
    disableCursor: false,
    disableGraph: false,
    equalWeights: false,
  },
  {
    id: "abl-confidence",
    name: "−Confidence",
    description: "Zero out the confidence component in scoring.",
    weightOverrides: {},
    disableComponents: ["confidence"],
    disableCursor: false,
    disableGraph: false,
    equalWeights: false,
  },
  {
    id: "abl-equal-weights",
    name: "Equal Weights",
    description: "Use uniform 20% weights for all five components.",
    weightOverrides: {},
    disableComponents: [],
    disableCursor: false,
    disableGraph: false,
    equalWeights: true,
  },
];

// ── Ablation Runner ─────────────────────────────────────────────────────────

/**
 * Run a single ablation across all benchmark episodes.
 */
export function runAblation(
  config: AblationConfig,
  episodes: Episode[],
): AblationRunResult {
  const predictions = episodes.map((ep) => {
    // Apply cursor ablation: push cursor back to sequence 0
    // so the system sees the entire window from scratch (no prior knowledge)
    let cursor = ep.cursor;
    if (config.disableCursor) {
      cursor = {
        ...ep.cursor,
        lastSeenSequence: 0,
        lastSeenEventTime: ep.snapshots[0]?.eventTime ?? null,
      };
    }

    // Apply graph ablation
    const graphs = config.disableGraph ? [] : ep.graphs;

    const modifiedEp: Episode = {
      ...ep,
      cursor,
      graphs,
    };

    return evaluateEpisode(modifiedEp, {
      disableComponents: config.disableComponents.length > 0 ? config.disableComponents : undefined,
      equalWeights: config.equalWeights,
    });
  });

  const metrics = computeAllMetrics(predictions, episodes);

  return {
    ablationId: config.id,
    variantName: config.name,
    predictions,
    metrics,
  };
}

/**
 * Run all ablation configurations.
 */
export function runAllAblations(
  episodes: Episode[],
): AblationRunResult[] {
  return ABLATION_CONFIGS.map((config) => runAblation(config, episodes));
}

export function getAblationConfig(id: string): AblationConfig | undefined {
  return ABLATION_CONFIGS.find((a) => a.id === id);
}
