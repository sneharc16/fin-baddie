// ─────────────────────────────────────────────────────────────────────────────
// Benchmark: Deterministic Controlled Generator
//
// Generates 300 episodes across 40 scenarios with:
// - Deterministic seeding for reproducibility
// - Synthetic but realistic market data
// - Independent gold labels
// - No dependency on browser/UI/database
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Benchmark,
  Episode,
  EpisodeGoldLabels,
  ScenarioDefinition,
  EventGenerator,
  IntentConfig,
  GraphConfig,
} from "../types";
import type {
  MarketSnapshotRecord,
  MarketEventRecord,
  MarketQuality,
} from "@/domain/market/types";
import type { KnowledgeCursorRecord } from "@/domain/market/types";
import type { WatchIntentRecord } from "@/domain/intent/types";
import type { WatchGraphRecord, WatchGraphNodeRecord, WatchGraphEdgeRecord } from "@/domain/graph/types";
import type { InstrumentRecord } from "@/domain/instrument/types";
import { generateGoldLabels, validateGoldLabels } from "./gold-labels";
import { SCENARIOS } from "./scenarios";
import { BENCHMARK_CONFIG } from "../config";
import { createHash } from "node:crypto";

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomId(rng: () => number, prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = prefix;
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(rng() * chars.length)];
  }
  return id;
}

// ── Market Data Generators ──────────────────────────────────────────────────

function generateSnapshots(
  scenario: ScenarioDefinition,
  rng: () => number,
): MarketSnapshotRecord[] {
  const snapshots: MarketSnapshotRecord[] = [];
  const basePrice = scenario.basePricePaise;
  const steps = scenario.steps;

  // Simulate a random walk with event-driven shocks
  let currentPrice = basePrice;
  for (let step = 0; step < steps; step++) {
    // Base random walk: ±0.5% per step
    const drift = (rng() - 0.5) * basePrice * 0.01;

    // Event-driven price shock at event steps
    const eventAtStep = scenario.eventGenerators.find((e) => e.step === step);
    let shock = 0;
    if (eventAtStep) {
      // Significant events cause 1-5% price moves
      shock = (rng() > 0.5 ? 1 : -1) * basePrice * (0.01 + rng() * 0.04);
    }

    currentPrice = Math.max(
      basePrice * 0.8,
      Math.min(basePrice * 1.2, currentPrice + drift + shock),
    );

    const pricePaise = Math.round(currentPrice);
    const vol = Math.round(100 + rng() * 900);
    const expectedVol = Math.round(100 + rng() * 200);
    // Inject volume spikes at event steps
    const effectiveVol = eventAtStep
      ? Math.round(expectedVol * (1.5 + rng() * 2))
      : vol;

    // Data quality: mostly FRESH, occasionally DELAYED
    const qualityRoll = rng();
    const quality: MarketQuality =
      qualityRoll < 0.85 ? "FRESH" :
      qualityRoll < 0.95 ? "DELAYED" :
      qualityRoll < 0.98 ? "STALE" :
      "CONFLICTING";

    snapshots.push({
      id: randomId(rng, "snap:"),
      instrumentId: scenario.instrument.id,
      sequence: step,
      eventTime: new Date(Date.parse("2025-08-14T04:30:00Z") + step * 60_000),
      pricePaise,
      openPaise: pricePaise - Math.round(drift),
      highPaise: pricePaise + Math.round(Math.abs(drift) * 0.5),
      lowPaise: pricePaise - Math.round(Math.abs(drift) * 0.5),
      cumulativeVolume: BigInt(effectiveVol),
      expectedCumulativeVolume: BigInt(expectedVol),
      expectedStepMoveBps: 20 + Math.round(rng() * 30),
      source: "benchmark-generator",
      quality,
    });
  }

  return snapshots;
}

function generateEvents(
  scenario: ScenarioDefinition,
  rng: () => number,
): MarketEventRecord[] {
  const events: MarketEventRecord[] = [];
  for (const gen of scenario.eventGenerators) {
    events.push({
      id: randomId(rng, "evt:"),
      sequence: gen.step,
      instrumentId: scenario.instrument.id,
      type: gen.type,
      eventTime: new Date(Date.parse("2025-08-14T04:30:00Z") + gen.step * 60_000),
      receivedTime: new Date(Date.parse("2025-08-14T04:30:00Z") + gen.step * 60_000),
      source: "benchmark-generator",
      quality: gen.quality,
      payload: gen.payload(rng() * 10000),
      subjectType: gen.subjectType,
      subjectKey: gen.subjectKey,
      tags: gen.tags,
      correctionOfId: null,
    });
  }
  return events;
}

function generateIntents(
  configs: IntentConfig[],
  instrumentId: string,
  rng: () => number,
): WatchIntentRecord[] {
  return configs.map((config, idx) => ({
    id: randomId(rng, "int:"),
    logicalIntentId: config.logicalIntentId,
    userId: "benchmark-user",
    instrumentId,
    type: config.type,
    originalText: config.originalText,
    structuredPayload: config.structuredPayload,
    provenanceSource: "MANUAL" as const,
    provenanceReference: null,
    status: "ACTIVE" as const,
    version: config.version,
    effectiveFromSequence: config.effectiveFromSequence,
    resolvedAt: null,
    resolvedAtSequence: null,
    lifecycleReviewedThroughSequence: null,
    supersedesId: null,
    horizon: null,
    expiresAt: null,
    createdAt: new Date(Date.parse("2025-08-14T04:00:00Z") + idx * 1000),
    updatedAt: new Date(Date.parse("2025-08-14T04:00:00Z") + idx * 1000),
  }));
}

function generateGraphs(
  graphConfig: GraphConfig | null,
  instrumentId: string,
  intentLogicalId: string,
  rng: () => number,
): WatchGraphRecord[] {
  if (!graphConfig) return [];

  const graphId = randomId(rng, "grf:");
  const now = new Date("2025-08-14T04:30:00Z");

  const nodes: WatchGraphNodeRecord[] = graphConfig.nodes.map((node, idx) => ({
    id: `${graphId}-n${idx}`,
    graphId,
    nodeKey: node.nodeKey,
    type: node.type,
    label: node.label,
    metadata: {},
    createdAt: now,
  }));

  const nodeKeyToId = new Map(nodes.map((n) => [n.nodeKey, n.id]));

  const edges: WatchGraphEdgeRecord[] = graphConfig.edges.map((edge, idx) => ({
    id: `${graphId}-e${idx}`,
    graphId,
    fromNodeId: nodeKeyToId.get(edge.fromKey) ?? "",
    toNodeId: nodeKeyToId.get(edge.toKey) ?? "",
    relationship: edge.relationship,
    weight: edge.weight,
    createdAt: now,
  }));

  return [{
    id: graphId,
    logicalGraphId: `logical-${graphId}`,
    userId: "benchmark-user",
    instrumentId,
    watchIntentLogicalId: intentLogicalId,
    version: 1,
    status: "ACTIVE",
    provenance: "CURATED_TEMPLATE",
    templateKey: null,
    effectiveFromSequence: 0,
    supersedesId: null,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
  }];
}

function generateCursor(
  instrumentId: string,
  rng: () => number,
  maxSequence: number,
): KnowledgeCursorRecord {
  const now = new Date("2025-08-14T04:30:00Z");
  // Vary cursor position: 0%–30% of the episode window to simulate
  // users who have seen some but not all steps.
  // Ensure at least 1 step remains in the catch-up window (cursor < maxSequence - 1)
  const maxCursor = Math.max(1, Math.floor(maxSequence * 0.30));
  const lastSeenSequence = Math.floor(rng() * maxCursor);
  return {
    id: `cursor-bench-${instrumentId}`,
    userId: "benchmark-user",
    instrumentId,
    lastSeenSequence,
    lastSeenEventTime: new Date(now.getTime() + lastSeenSequence * 60_000),
    lastObservedSnapshotId: null,
    cursorVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Episode Generation ──────────────────────────────────────────────────────

function generateEpisode(
  scenario: ScenarioDefinition,
  episodeIndex: number,
  baseSeed: number,
): Episode {
  const seed = baseSeed + episodeIndex * 7919; // Large prime for spacing
  const rng = mulberry32(seed);

  const snapshots = generateSnapshots(scenario, rng);
  const events = generateEvents(scenario, rng);
  const intents = generateIntents(
    scenario.intentConfigs,
    scenario.instrument.id,
    rng,
  );

  // Pick the first intent's logicalIntentId for graph association
  const firstIntentId = scenario.intentConfigs[0]?.logicalIntentId ?? "none";
  const graphs = generateGraphs(
    scenario.graphConfig,
    scenario.instrument.id,
    firstIntentId,
    rng,
  );

  const cursor = generateCursor(scenario.instrument.id, rng, scenario.steps);

  // Evaluation point: the last step
  const evalStep = scenario.steps - 1;

  // Generate gold labels independently
  const goldLabels = generateGoldLabels(scenario, evalStep);

  return {
    id: `ep-${scenario.key}-${episodeIndex}`,
    seed,
    scenarioKey: scenario.key,
    evalStep,
    snapshots,
    events,
    intents,
    graphs,
    cursor,
    currentSequence: evalStep,
    currentTime: new Date(Date.parse("2025-08-14T04:30:00Z") + evalStep * 60_000),
    instrument: scenario.instrument,
    goldLabels,
  };
}

// ── Benchmark Assembly ──────────────────────────────────────────────────────

function computeChecksum(data: string): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

export interface GenerateBenchmarkOptions {
  seed?: number;
  targetEpisodes?: number;
}

export function generateBenchmark(
  options: GenerateBenchmarkOptions = {},
): Benchmark {
  const seed = options.seed ?? 42;
  const targetEpisodes = options.targetEpisodes ?? BENCHMARK_CONFIG.targetEpisodes;

  // ── Stratified allocation: guarantee minimum episodes per category ──
  // Group scenarios by category
  const categories = new Map<string, ScenarioDefinition[]>();
  for (const scenario of SCENARIOS) {
    const list = categories.get(scenario.category) ?? [];
    list.push(scenario);
    categories.set(scenario.category, list);
  }

  // Phase 1: guarantee at least minEpisodesPerCategory across each category
  const allEpisodes: Episode[] = [];
  const minPerCategory = BENCHMARK_CONFIG.minEpisodesPerCategory;
  const assignedPerScenario = new Map<string, number>();

  for (const [, scenarios] of categories) {
    const perScenario = Math.ceil(minPerCategory / scenarios.length);
    for (const scenario of scenarios) {
      const count = Math.min(perScenario, minPerCategory);
      for (let eIdx = 0; eIdx < count; eIdx++) {
        allEpisodes.push(generateEpisode(scenario, eIdx, seed));
      }
      assignedPerScenario.set(scenario.key, count);
    }
  }

  // Phase 2: distribute remaining episodes evenly across all scenarios
  const remaining = targetEpisodes - allEpisodes.length;
  if (remaining > 0) {
    const perScenarioExtra = Math.floor(remaining / SCENARIOS.length);
    const extraRemainder = remaining % SCENARIOS.length;
    for (let sIdx = 0; sIdx < SCENARIOS.length; sIdx++) {
      const scenario = SCENARIOS[sIdx];
      const base = assignedPerScenario.get(scenario.key) ?? 0;
      const extra = perScenarioExtra + (sIdx < extraRemainder ? 1 : 0);
      for (let eIdx = 0; eIdx < extra; eIdx++) {
        allEpisodes.push(generateEpisode(scenario, base + eIdx, seed));
      }
      assignedPerScenario.set(scenario.key, base + extra);
    }
  }

  // Trim to exact target if overshot
  const episodes = allEpisodes.slice(0, targetEpisodes);

  // Validate gold labels
  for (const ep of episodes) {
    const scenario = SCENARIOS.find((s) => s.key === ep.scenarioKey)!;
    const errors = validateGoldLabels(ep.goldLabels, scenario);
    if (errors.length > 0) {
      console.warn(`Gold label warnings for ${ep.id}:`, errors);
    }
  }

  // Category counts
  const scenarioCategories: Record<string, number> = {};
  const scenarioCounts: Record<string, number> = {};
  for (const ep of episodes) {
    scenarioCounts[ep.scenarioKey] = (scenarioCounts[ep.scenarioKey] ?? 0) + 1;
  }
  for (const scenario of SCENARIOS) {
    const cat = scenario.category;
    scenarioCategories[cat] = (scenarioCategories[cat] ?? 0) + (scenarioCounts[scenario.key] ?? 0);
  }

  // Compute checksum
  const checksumData = JSON.stringify({
    version: BENCHMARK_CONFIG.version,
    episodeCount: episodes.length,
    scenarioCount: SCENARIOS.length,
    seed,
  });
  const checksum = computeChecksum(checksumData);

  return {
    version: BENCHMARK_CONFIG.version,
    checksum,
    createdAt: new Date().toISOString(),
    episodeCount: episodes.length,
    scenarioCount: SCENARIOS.length,
    scenarioCategories,
    episodes,
  };
}
