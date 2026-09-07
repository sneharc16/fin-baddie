import type { AttentionLane } from "./types";

export const QUALITY_CONFIDENCE = {
  FRESH: 100,
  DELAYED: 70,
  STALE: 30,
  CONFLICTING: 0,
  CORRECTED: 80,
} as const;

export function calculateAttentionScore(values: {
  significance: number;
  relevance: number;
  novelty: number;
  urgency: number;
  confidence: number;
}): number {
  const score = 0.30 * values.significance
    + 0.35 * values.relevance
    + 0.15 * values.novelty
    + 0.10 * values.urgency
    + 0.10 * values.confidence;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyLane(relevance: number, significance: number): AttentionLane {
  if (relevance > 0) return "RELEVANT";
  if (significance >= 50) return "SIGNIFICANT";
  return "QUIET";
}
