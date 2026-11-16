// ─────────────────────────────────────────────────────────────────────────────
// Research Module — Public API
//
// Groww Delta V3 → AIST 2026 Research Conversion Blueprint
// ─────────────────────────────────────────────────────────────────────────────

// Types
export type {
  Episode,
  EpisodePrediction,
  Benchmark,
  Baseline,
  MetricResult,
  AggregateMetrics,
  ScaleMetrics,
  AblationConfig,
  ExperimentConfig,
  ExperimentResult,
  ScoreComponents,
  RankedItem,
  ScenarioDefinition,
  GoldLabelConfig,
  EpisodeGoldLabels,
  StatisticalTest,
  ComparisonResult,
} from "./types";

// Config
export {
  V3_WEIGHTS,
  V3_LANE_RULES,
  V3_GRAPH_BOUNDS,
  BENCHMARK_CONFIG,
  EVAL_CONFIG,
} from "./config";

// Benchmark
export { SCENARIOS, getScenariosByCategory, getScenarioByKey } from "./benchmark/scenarios";
export { generateBenchmark } from "./benchmark/generator";
export { generateGoldLabels, validateGoldLabels } from "./benchmark/gold-labels";
export { validateBenchmark, checkTemporalLeakage } from "./benchmark/validate";

// Delta Adapter
export { evaluateEpisode, evaluateBenchmark } from "./delta/adapter";

// Metrics
export {
  ndcgAtK,
  precisionAtK,
  recallAtK,
  meanReciprocalRank,
  macroF1,
  weightedF1,
  computeLaneDistribution,
  repeatSurfaceRate,
  contextualRecall,
  computeAllMetrics,
  computeSubsetMetrics,
  extractPerEpisodeMetricValues,
  perEpisodeNDCG,
  perEpisodePrecision,
  perEpisodeRecall,
  perEpisodeMRR,
  perEpisodeMacroF1,
} from "./metrics";

// Stats
export {
  pairedBootstrapCI,
  bootstrapCI,
  cohensD,
  wilcoxonSignedRank,
  holmCorrection,
  enrichWithCI,
  computeStatisticalTests,
} from "./stats";

// Baselines
export { BASELINES, getBaseline, getBaselineIds } from "./baselines";

// Ablations
export { ABLATION_CONFIGS, runAblation, runAllAblations } from "./ablations";

// Scale
export { runScaleBenchmark } from "./scale";

// Paper Tables
export { exportPaperTables } from "./export-paper-tables";
