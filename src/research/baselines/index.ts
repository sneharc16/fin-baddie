// ─────────────────────────────────────────────────────────────────────────────
// Baseline Registry
// ─────────────────────────────────────────────────────────────────────────────

import type { Baseline } from "../types";
import { B0_PRICE_MOVEMENT } from "./b0-price-movement";
import { B1_SIGNIFICANCE } from "./b1-significance";
import { B2_INTENT_ONLY } from "./b2-intent-only";
import { B3_INTENT_SIGNIFICANCE } from "./b3-intent-significance";
import { B4_LR_RANKER } from "./b4-lr-ranker";

export const BASELINES: Baseline[] = [
  B0_PRICE_MOVEMENT,
  B1_SIGNIFICANCE,
  B2_INTENT_ONLY,
  B3_INTENT_SIGNIFICANCE,
  B4_LR_RANKER, // Gradient-Boosted Decision Tree Ranker
];

export function getBaseline(id: string): Baseline | undefined {
  return BASELINES.find((b) => b.id === id);
}

export function getBaselineIds(): string[] {
  return BASELINES.map((b) => b.id);
}

export {
  B0_PRICE_MOVEMENT,
  B1_SIGNIFICANCE,
  B2_INTENT_ONLY,
  B3_INTENT_SIGNIFICANCE,
  B4_LR_RANKER,
};
