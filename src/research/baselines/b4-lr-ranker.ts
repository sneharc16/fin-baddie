// ─────────────────────────────────────────────────────────────────────────────
// Baseline B4: Gradient-Boosted Decision Tree Ranker
//
// Learns a scoring function from V3 component outputs using gradient boosting
// with shallow decision trees. Uses binary relevance as training labels.
//
// Model: 50 trees, max depth 3, learning rate 0.1, subsample 0.8
// Features: [significance, relevance, novelty, urgency, confidence] from V3
// Labels: binary gold relevance (1 if gold step relevance > 0, else 0)
// Split: stratified by scenario, 80% train / 20% test
// ─────────────────────────────────────────────────────────────────────────────

import type { Baseline, Episode, EpisodePrediction, RankedItem, ScoreComponents } from "../types";
import type { AttentionLane } from "@/domain/attention/types";
import { analyzeInstrument } from "@/domain/attention/analyze-instrument";

// ── Seeded PRNG for reproducibility ─────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Decision Tree (regression, used as weak learner in gradient boosting) ───

interface TreeNode {
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  value: number; // leaf value (mean residual) or split value
  isLeaf: boolean;
}

function buildTree(
  X: number[][],
  residuals: number[],
  maxDepth: number,
  minSamplesLeaf: number,
  rng: () => number,
): TreeNode {
  if (residuals.length === 0 || maxDepth <= 0) {
    return { value: residuals.length > 0 ? mean(residuals) : 0, isLeaf: true };
  }

  if (residuals.length <= minSamplesLeaf) {
    return { value: mean(residuals), isLeaf: true };
  }

  const nFeatures = X[0]?.length ?? 0;
  let bestFeature = 0;
  let bestThreshold = 0;
  let bestGain = -Infinity;
  const currentVariance = variance(residuals);

  // Sample sqrt(nFeatures) features to consider (feature subsampling)
  const nSample = Math.max(1, Math.floor(Math.sqrt(nFeatures)));
  const featureIndices: number[] = [];
  const used = new Set<number>();
  while (featureIndices.length < nSample && featureIndices.length < nFeatures) {
    const idx = Math.floor(rng() * nFeatures);
    if (!used.has(idx)) {
      used.add(idx);
      featureIndices.push(idx);
    }
  }

  for (const fIdx of featureIndices) {
    const values = X.map((x) => x[fIdx]);
    const sorted = [...new Set(values)].sort((a, b) => a - b);

    // Try a few thresholds
    const nThresholds = Math.min(10, sorted.length - 1);
    for (let t = 0; t < nThresholds; t++) {
      const tIdx = Math.floor((t / nThresholds) * sorted.length);
      const threshold = sorted[tIdx];

      const leftY: number[] = [];
      const rightY: number[] = [];
      for (let i = 0; i < X.length; i++) {
        if (values[i] <= threshold) {
          leftY.push(residuals[i]);
        } else {
          rightY.push(residuals[i]);
        }
      }

      if (leftY.length < minSamplesLeaf || rightY.length < minSamplesLeaf) continue;

      const leftVar = variance(leftY);
      const rightVariance = variance(rightY);
      const weightedVar = (leftY.length * leftVar + rightY.length * rightVariance) / X.length;
      const gain = currentVariance - weightedVar;

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = fIdx;
        bestThreshold = threshold;
      }
    }
  }

  if (bestGain <= 0) {
    return { value: mean(residuals), isLeaf: true };
  }

  const leftX: number[][] = [];
  const leftR: number[] = [];
  const rightX: number[][] = [];
  const rightR: number[] = [];
  for (let i = 0; i < X.length; i++) {
    if (X[i][bestFeature] <= bestThreshold) {
      leftX.push(X[i]);
      leftR.push(residuals[i]);
    } else {
      rightX.push(X[i]);
      rightR.push(residuals[i]);
    }
  }

  return {
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left: buildTree(leftX, leftR, maxDepth - 1, minSamplesLeaf, rng),
    right: buildTree(rightX, rightR, maxDepth - 1, minSamplesLeaf, rng),
    value: 0,
    isLeaf: false,
  };
}

function predictTree(tree: TreeNode, x: number[]): number {
  if (tree.isLeaf) return tree.value;
  if (tree.featureIndex === undefined || tree.threshold === undefined) return tree.value;
  if (x[tree.featureIndex] <= tree.threshold) {
    return predictTree(tree.left!, x);
  }
  return predictTree(tree.right!, x);
}

// ── Gradient Boosted Decision Trees ─────────────────────────────────────────

interface GBDTModel {
  trees: TreeNode[];
  basePrediction: number;
  learningRate: number;
}

function fitGBDT(
  X: number[][],
  y: number[],
  config: {
    nTrees: number;
    maxDepth: number;
    learningRate: number;
    subsample: number;
    minSamplesLeaf: number;
    seed: number;
  },
): GBDTModel {
  const rng = mulberry32(config.seed);
  const basePrediction = mean(y);
  const trees: TreeNode[] = [];

  // Initial predictions
  let predictions = new Array(X.length).fill(basePrediction);

  for (let t = 0; t < config.nTrees; t++) {
    // Compute residuals (negative gradient for squared loss)
    const residuals = y.map((yi, i) => yi - predictions[i]);

    // Subsample data
    const sampleSize = Math.floor(X.length * config.subsample);
    const indices: number[] = [];
    const used = new Set<number>();
    while (indices.length < sampleSize) {
      const idx = Math.floor(rng() * X.length);
      if (!used.has(idx)) {
        used.add(idx);
        indices.push(idx);
      }
    }
    const sampleX = indices.map((i) => X[i]);
    const sampleR = indices.map((i) => residuals[i]);

    // Build tree on residuals
    const tree = buildTree(sampleX, sampleR, config.maxDepth, config.minSamplesLeaf, rng);
    trees.push(tree);

    // Update predictions
    for (let i = 0; i < X.length; i++) {
      predictions[i] += config.learningRate * predictTree(tree, X[i]);
    }
  }

  return { trees, basePrediction, learningRate: config.learningRate };
}

function predictGBDT(model: GBDTModel, x: number[]): number {
  let pred = model.basePrediction;
  for (const tree of model.trees) {
    pred += model.learningRate * predictTree(tree, x);
  }
  // Clamp to [0, 1] via sigmoid for probability-like output
  return 1 / (1 + Math.exp(-pred));
}

// ── Utility functions ───────────────────────────────────────────────────────

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function variance(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  return arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
}

// ── Feature extraction ──────────────────────────────────────────────────────

function extractFeatures(ep: Episode): number[] {
  const snapshots = [...ep.snapshots].sort((a, b) => a.sequence - b.sequence);
  const baseline = snapshots.filter((s) => s.sequence <= ep.cursor.lastSeenSequence).at(-1);
  const current = snapshots.filter((s) => s.sequence <= ep.currentSequence).at(-1);

  if (!baseline || !current) return [0, 0, 0, 0, 0];

  const input = {
    instrument: ep.instrument,
    cursor: ep.cursor,
    currentSequence: ep.currentSequence,
    currentTime: ep.currentTime,
    snapshots: ep.snapshots,
    events: ep.events,
    activeIntents: ep.intents,
    activeGraphs: ep.graphs,
  };

  const result = analyzeInstrument(input);

  return [
    result?.significance ?? 0,
    result?.relevance ?? 0,
    result?.novelty ?? 0,
    result?.urgency ?? 0,
    result?.confidence ?? 0,
  ];
}

// ── B4 Gradient-Boosted Ranker ──────────────────────────────────────────────

const GBDT_CONFIG = {
  nTrees: 50,
  maxDepth: 3,
  learningRate: 0.1,
  subsample: 0.8,
  minSamplesLeaf: 5,
  seed: 42,
};

export const B4_LR_RANKER: Baseline = {
  id: "B4-gbdt-ranker",
  name: "Gradient-Boosted Decision Tree Ranker",
  description: `Learns a scoring function from V3 component outputs using gradient-boosted decision trees (${GBDT_CONFIG.nTrees} trees, depth ${GBDT_CONFIG.maxDepth}, lr ${GBDT_CONFIG.learningRate}, subsample ${GBDT_CONFIG.subsample}). Stratified 80/20 train/test split by scenario. No train/test leakage.`,

  predict(benchmark: { episodes: Episode[] }): EpisodePrediction[] {
    const episodes = benchmark.episodes;

    // Extract features and labels from all episodes
    const X = episodes.map((ep) => extractFeatures(ep));
    const y = episodes.map((ep) => {
      const goldRelevance = ep.goldLabels.stepRelevance[ep.evalStep] ?? 0;
      return goldRelevance > 0 ? 1 : 0;
    });

    // Stratified train/test split by scenario (80/20)
    const scenarioGroups = new Map<string, number[]>();
    for (let i = 0; i < episodes.length; i++) {
      const key = episodes[i].scenarioKey;
      const list = scenarioGroups.get(key) ?? [];
      list.push(i);
      scenarioGroups.set(key, list);
    }

    const trainIndices: number[] = [];
    const testIndices: number[] = [];
    for (const [, indices] of scenarioGroups) {
      const splitPoint = Math.max(1, Math.floor(indices.length * 0.8));
      for (let i = 0; i < indices.length; i++) {
        if (i < splitPoint) {
          trainIndices.push(indices[i]);
        } else {
          testIndices.push(indices[i]);
        }
      }
    }

    const trainX = trainIndices.map((i) => X[i]);
    const trainY = trainIndices.map((i) => y[i]);
    const testX = testIndices.map((i) => X[i]);

    // Fit gradient-boosted trees on training set only
    const model = fitGBDT(trainX, trainY, GBDT_CONFIG);

    // Predict ONLY on held-out test set
    const testProbs = testX.map((x) => predictGBDT(model, x));
    const testProbMap = new Map<number, number>();
    for (let i = 0; i < testIndices.length; i++) {
      testProbMap.set(testIndices[i], testProbs[i]);
    }

    return episodes.map((ep, idx) => {
      const startTime = performance.now();

      const prob = testProbMap.get(idx);
      const isTest = prob !== undefined;
      const score = isTest ? Math.round(prob! * 100) : 0;

      // Build ranked items — only for test episodes
      const rankedItems = isTest ? buildRankedItems(ep) : [];

      const lane: AttentionLane =
        !isTest ? "QUIET" :
        prob! > 0.5 ? "RELEVANT" :
        prob! > 0.3 ? "SIGNIFICANT" :
        "QUIET";

      const features = X[idx];
      const components: ScoreComponents = {
        significance: features[0],
        relevance: features[1],
        novelty: features[2],
        urgency: features[3],
        confidence: features[4],
      };

      return {
        episodeId: ep.id,
        scenarioKey: ep.scenarioKey,
        score,
        lane,
        rankedItems,
        components,
        latencyUs: (performance.now() - startTime) * 1000,
        graphNodesVisited: 0,
      };
    });
  },
};

function buildRankedItems(ep: Episode): RankedItem[] {
  const items: RankedItem[] = [];

  for (let step = ep.cursor.lastSeenSequence + 1; step <= ep.currentSequence; step++) {
    const stepSnapshots = ep.snapshots.filter((s) => s.sequence <= step);
    const stepEvents = ep.events.filter((e) => e.sequence <= step);

    const input = {
      instrument: ep.instrument,
      cursor: ep.cursor,
      currentSequence: step,
      currentTime: stepSnapshots.at(-1)?.eventTime ?? ep.currentTime,
      snapshots: stepSnapshots,
      events: stepEvents,
      activeIntents: ep.intents,
      activeGraphs: ep.graphs,
    };

    const result = analyzeInstrument(input);

    items.push({
      rank: 0,
      stepIndex: step,
      score: result?.score ?? 0,
      lane: result?.lane ?? "QUIET",
    });
  }

  items.sort((a, b) => b.score - a.score);
  for (let i = 0; i < items.length; i++) items[i].rank = i + 1;
  return items.slice(0, 5);
}
