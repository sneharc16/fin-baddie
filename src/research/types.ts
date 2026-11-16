// ─────────────────────────────────────────────────────────────────────────────
// Groww Delta V3 → AIST 2026 Research Conversion: Core Types
// ─────────────────────────────────────────────────────────────────────────────

import type { AttentionLane } from "@/domain/attention/types";
import type {
  MarketEventRecord,
  MarketSnapshotRecord,
  MarketQuality,
  KnowledgeCursorRecord,
  MarketEventType,
} from "@/domain/market/types";
import type { InstrumentRecord } from "@/domain/instrument/types";
import type {
  WatchGraphNodeRecord,
  WatchGraphEdgeRecord,
  WatchGraphRecord,
} from "@/domain/graph/types";
import type { WatchIntentRecord } from "@/domain/intent/types";

// ── Scenario & Episode ──────────────────────────────────────────────────────

export interface ScenarioDefinition {
  /** Stable human-readable key, e.g. "EARNINGS_MISS_BANK" */
  key: string;
  /** Category for stratified sampling */
  category:
    | "PRICE_LEVEL"
    | "EARNINGS"
    | "DIVIDEND"
    | "TECHNICAL"
    | "COMPANY_EVENT"
    | "DRIVER"
    | "MULTI_SIGNAL"
    | "QUIET";
  /** Instrument used in this scenario */
  instrument: InstrumentRecord;
  /** Number of snapshot steps in the episode window */
  steps: number;
  /** Base price in paise */
  basePricePaise: number;
  /** Event generators that fire at specific steps */
  eventGenerators: EventGenerator[];
  /** Intent configuration for this scenario */
  intentConfigs: IntentConfig[];
  /** Graph configuration (null means no graph) */
  graphConfig: GraphConfig | null;
  /** Gold label configuration — per-step relevance weights */
  goldConfig: GoldLabelConfig;
}

export interface EventGenerator {
  /** Step index (0-based) at which the event fires */
  step: number;
  /** Event type */
  type: MarketEventType;
  /** Payload factory */
  payload: (seed: number) => Record<string, unknown>;
  /** Subject metadata */
  subjectType: "INSTRUMENT" | "METRIC" | "DRIVER" | "EXTERNAL_DRIVER" | null;
  subjectKey: string | null;
  tags: string[];
  /** Quality of this event */
  quality: MarketQuality;
}

export interface IntentConfig {
  logicalIntentId: string;
  type: WatchIntentRecord["type"];
  structuredPayload: unknown;
  originalText: string;
  effectiveFromSequence: number;
  version: number;
}

export interface GraphConfig {
  nodes: Array<{
    nodeKey: string;
    type: WatchGraphNodeRecord["type"];
    label: string;
  }>;
  edges: Array<{
    fromKey: string;
    toKey: string;
    relationship: WatchGraphEdgeRecord["relationship"];
    weight: number;
  }>;
}

export interface GoldLabelConfig {
  /**
   * Map from step index to gold relevance (0-100).
   * Gold labels are generated independently from Delta's outputs.
   */
  stepRelevance: Record<number, number>;
  /**
   * Map from step index to gold lane classification.
   */
  stepLane: Record<number, AttentionLane>;
  /**
   * Set of step indices that should surface in the top-5.
   */
  relevantSteps: number[];
  /**
   * Domain-expert rationale per step (for audit trail).
   */
  rationale: Record<number, string>;
}

export interface Episode {
  id: string;
  seed: number;
  scenarioKey: string;
  /** The step at which we evaluate (end of window) */
  evalStep: number;
  /** All snapshots up to and including evalStep */
  snapshots: MarketSnapshotRecord[];
  /** All events up to and including evalStep */
  events: MarketEventRecord[];
  /** Active intents for this episode */
  intents: WatchIntentRecord[];
  /** Active graphs for this episode */
  graphs: WatchGraphRecord[];
  /** Cursor position (last seen sequence) */
  cursor: KnowledgeCursorRecord;
  /** Current sequence at evaluation point */
  currentSequence: number;
  /** Current time at evaluation point */
  currentTime: Date;
  /** Instrument */
  instrument: InstrumentRecord;
  /** Gold labels — independently generated */
  goldLabels: EpisodeGoldLabels;
}

export interface EpisodeGoldLabels {
  /** Per-step relevance scores (0-100), generated independently */
  stepRelevance: Record<number, number>;
  /** Binary relevance for top-k metrics (step → boolean) */
  binaryRelevance: Record<number, boolean>;
  /** Overall lane for this episode at eval step */
  lane: AttentionLane;
  /** Human expert rationale */
  rationale: string;
}

// ── Benchmark ───────────────────────────────────────────────────────────────

export interface Benchmark {
  version: string;
  checksum: string;
  createdAt: string;
  episodeCount: number;
  scenarioCount: number;
  scenarioCategories: Record<string, number>;
  episodes: Episode[];
}

export interface BenchmarkManifest {
  version: string;
  checksum: string;
  episodeCount: number;
  scenarioCount: number;
  createdAt: string;
}

// ── Prediction & Evaluation ─────────────────────────────────────────────────

export interface EpisodePrediction {
  episodeId: string;
  scenarioKey: string;
  score: number;
  lane: AttentionLane;
  /** Ordered ranked items (top-5) with their scores */
  rankedItems: RankedItem[];
  /** Per-component breakdown */
  components: ScoreComponents;
  /** Latency in microseconds for this episode */
  latencyUs: number;
  /** Number of graph nodes visited during evaluation */
  graphNodesVisited: number;
}

export interface RankedItem {
  rank: number;
  stepIndex: number;
  score: number;
  lane: AttentionLane;
}

export interface ScoreComponents {
  significance: number;
  relevance: number;
  novelty: number;
  urgency: number;
  confidence: number;
}

// ── Baseline ────────────────────────────────────────────────────────────────

export interface Baseline {
  id: string;
  name: string;
  description: string;
  /** Generate predictions for a benchmark */
  predict(benchmark: Benchmark): EpisodePrediction[];
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export interface MetricResult {
  name: string;
  value: number;
  /** 95% confidence interval via paired bootstrap */
  ci95: [number, number] | null;
  /** Standard error */
  se: number | null;
}

export interface AggregateMetrics {
  ndcgAt5: MetricResult;
  precisionAt5: MetricResult;
  recallAt5: MetricResult;
  repeatSurfaceRate: MetricResult;
  contextualRecall: MetricResult;
  mrr: MetricResult;
  macroF1: MetricResult;
  weightedF1: MetricResult;
  /** Lane distribution in gold labels (RELEVANT/SIGNIFICANT/QUIET counts) */
  laneDistribution: Record<string, number>;
}

// ── Statistical Analysis ────────────────────────────────────────────────────

export interface StatisticalTest {
  testName: string;
  statistic: number;
  pValue: number;
  effectSize: number | null;
  effectSizeMeasure: string | null;
  significantAfterHolm: boolean;
  holmAdjustedAlpha: number;
}

export interface ComparisonResult {
  baselineA: string;
  baselineB: string;
  metricDeltas: Record<string, number>;
  tests: StatisticalTest[];
}

// ── Scale Metrics ───────────────────────────────────────────────────────────

export interface ScaleMetrics {
  p50LatencyUs: number;
  p95LatencyUs: number;
  p99LatencyUs: number;
  throughputEpsPerSec: number;
  graphNodesVisitedP50: number;
  graphNodesVisitedP95: number;
  totalEpisodes: number;
  wallTimeMs: number;
}

// ── Experiment Run ───────────────────────────────────────────────────────────

export interface ExperimentConfig {
  experimentId: string;
  commitHash: string;
  seed: number;
  benchmarkVersion: string;
  benchmarkChecksum: string;
  runtimeVersions: RuntimeVersions;
  /** Which baselines to run */
  baselineIds: string[];
  /** Which ablations to run */
  ablationIds: string[];
  /** Bootstrap iterations for CIs */
  bootstrapIterations: number;
}

export interface RuntimeVersions {
  nodeVersion: string;
  typescriptVersion: string;
  projectVersion: string;
}

export interface ExperimentResult {
  config: ExperimentConfig;
  timestamp: string;
  baselineResults: BaselineRunResult[];
  ablationResults: AblationRunResult[];
  scaleResults: ScaleMetrics;
  comparisonResults: ComparisonResult[];
}

export interface BaselineRunResult {
  baselineId: string;
  predictions: EpisodePrediction[];
  metrics: AggregateMetrics;
}

export interface AblationRunResult {
  ablationId: string;
  variantName: string;
  predictions: EpisodePrediction[];
  metrics: AggregateMetrics;
}

// ── Ablation ────────────────────────────────────────────────────────────────

export interface AblationConfig {
  id: string;
  name: string;
  description: string;
  /** Weight overrides to apply to the scoring formula */
  weightOverrides: Partial<ScoreComponents>;
  /** Components to zero out */
  disableComponents: Array<keyof ScoreComponents>;
  /** Whether to disable the Knowledge Cursor */
  disableCursor: boolean;
  /** Whether to disable graph traversal */
  disableGraph: boolean;
  /** Whether to use equal weights */
  equalWeights: boolean;
}
