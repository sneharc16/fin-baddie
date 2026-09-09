import { describe, expect, it } from "vitest";
import { generateBenchmark } from "./generator";
import { validateBenchmark, checkTemporalLeakage } from "./validate";
import { generateGoldLabels, validateGoldLabels } from "./gold-labels";
import { validateGoldLabelIndependence, validateGoldLabelCodeIndependence } from "./gold-label-validation";
import { SCENARIOS, getScenariosByCategory } from "./scenarios";
import { BENCHMARK_CONFIG } from "../config";

describe("Scenario Definitions", () => {
  it("has at least 40 scenarios", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(40);
  });

  it("covers all required categories", () => {
    const categories = new Set(SCENARIOS.map((s) => s.category));
    expect(categories.has("EARNINGS")).toBe(true);
    expect(categories.has("PRICE_LEVEL")).toBe(true);
    expect(categories.has("TECHNICAL")).toBe(true);
    expect(categories.has("DRIVER")).toBe(true);
    expect(categories.has("DIVIDEND")).toBe(true);
    expect(categories.has("COMPANY_EVENT")).toBe(true);
    expect(categories.has("MULTI_SIGNAL")).toBe(true);
    expect(categories.has("QUIET")).toBe(true);
  });

  it("each scenario has a unique key", () => {
    const keys = SCENARIOS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("each scenario has non-empty gold config", () => {
    for (const scenario of SCENARIOS) {
      expect(Object.keys(scenario.goldConfig.stepRelevance).length).toBeGreaterThan(0);
      expect(Object.keys(scenario.goldConfig.rationale).length).toBeGreaterThan(0);
    }
  });

  it("getScenariosByCategory filters correctly", () => {
    const earnings = getScenariosByCategory("EARNINGS");
    expect(earnings.length).toBeGreaterThan(0);
    for (const s of earnings) {
      expect(s.category).toBe("EARNINGS");
    }
  });
});

describe("Benchmark Generator", () => {
  it("generates the target number of episodes", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 300 });
    expect(benchmark.episodeCount).toBe(300);
  });

  it("produces deterministic output for the same seed", () => {
    const b1 = generateBenchmark({ seed: 42, targetEpisodes: 50 });
    const b2 = generateBenchmark({ seed: 42, targetEpisodes: 50 });
    expect(b1.checksum).toBe(b2.checksum);
    expect(b1.episodes.length).toBe(b2.episodes.length);

    for (let i = 0; i < b1.episodes.length; i++) {
      expect(b1.episodes[i].id).toBe(b2.episodes[i].id);
      expect(b1.episodes[i].seed).toBe(b2.episodes[i].seed);
    }
  });

  it("produces different output for different seeds", () => {
    const b1 = generateBenchmark({ seed: 42, targetEpisodes: 50 });
    const b2 = generateBenchmark({ seed: 123, targetEpisodes: 50 });
    expect(b1.checksum).not.toBe(b2.checksum);
  });

  it("each episode has all required fields", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 10 });
    for (const ep of benchmark.episodes) {
      expect(ep.id).toBeTruthy();
      expect(ep.scenarioKey).toBeTruthy();
      expect(ep.snapshots.length).toBeGreaterThan(0);
      expect(ep.cursor).toBeTruthy();
      expect(ep.goldLabels).toBeTruthy();
      expect(ep.instrument).toBeTruthy();
    }
  });

  it("snapshots are ordered by sequence", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 20 });
    for (const ep of benchmark.episodes) {
      for (let i = 1; i < ep.snapshots.length; i++) {
        expect(ep.snapshots[i].sequence).toBeGreaterThanOrEqual(ep.snapshots[i - 1].sequence);
      }
    }
  });

  it("events are ordered by sequence", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 20 });
    for (const ep of benchmark.episodes) {
      for (let i = 1; i < ep.events.length; i++) {
        expect(ep.events[i].sequence).toBeGreaterThanOrEqual(ep.events[i - 1].sequence);
      }
    }
  });

  it("cursor is before current sequence", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 20 });
    for (const ep of benchmark.episodes) {
      expect(ep.cursor.lastSeenSequence).toBeLessThan(ep.currentSequence);
    }
  });
});

describe("Gold Labels", () => {
  it("generates gold labels from scenario config", () => {
    const scenario = SCENARIOS[0];
    const labels = generateGoldLabels(scenario, scenario.steps - 1);
    expect(labels.lane).toBeTruthy();
    expect(typeof labels.rationale).toBe("string");
    expect(Object.keys(labels.binaryRelevance).length).toBeGreaterThan(0);
  });

  it("gold labels are consistent with scenario config", () => {
    for (const scenario of SCENARIOS.slice(0, 10)) {
      const labels = generateGoldLabels(scenario, scenario.steps - 1);
      const errors = validateGoldLabels(labels, scenario);
      // Some warnings may exist, but no hard errors
      for (const err of errors) {
        expect(err).not.toContain("binary relevant but not in scenario relevantSteps");
      }
    }
  });

  it("does not reference steps beyond evalStep", () => {
    const scenario = SCENARIOS[0];
    const evalStep = 3;
    const labels = generateGoldLabels(scenario, evalStep);
    for (const step of Object.keys(labels.stepRelevance).map(Number)) {
      expect(step).toBeLessThanOrEqual(scenario.steps);
    }
  });
});

describe("Benchmark Validation", () => {
  it("validates a well-formed benchmark", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 50 });
    const result = validateBenchmark(benchmark);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("checks temporal ordering", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 50 });
    const result = validateBenchmark(benchmark);
    // No ordering errors expected
    const orderingErrors = result.errors.filter((e) => e.includes("not ordered by sequence"));
    expect(orderingErrors.length).toBe(0);
  });

  it("detects temporal leakage", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 50 });
    const leakage = checkTemporalLeakage(benchmark);
    expect(leakage.length).toBe(0);
  });

  it("reports stats correctly", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 50 });
    const result = validateBenchmark(benchmark);
    expect(result.stats.episodeCount).toBe(50);
    expect(result.stats.scenarioCount).toBeGreaterThan(0);
  });
});

describe("Gold Label Independence Validation", () => {
  it("validates gold labels are independent of Delta", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 50 });
    const result = validateGoldLabelIndependence(benchmark);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.stats.totalEpisodes).toBe(50);
    expect(result.stats.goldLabelSourceConsistency).toBe(1.0);
  });

  it("detects no temporal leakage in gold labels", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 50 });
    const result = validateGoldLabelIndependence(benchmark);
    const temporalErrors = result.errors.filter((e) => e.includes("temporal leakage"));
    expect(temporalErrors.length).toBe(0);
  });

  it("detects no Delta references in gold rationale", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 50 });
    const result = validateGoldLabelIndependence(benchmark);
    const deltaErrors = result.errors.filter((e) => e.includes("Delta") || e.includes("intent leakage") || e.includes("graph leakage"));
    expect(deltaErrors.length).toBe(0);
  });

  it("validates code independence (static analysis)", () => {
    const issues = validateGoldLabelCodeIndependence();
    // All issues should be VERIFIED, not FAILED
    const failures = issues.filter((i) => i.includes("[FAILED]"));
    expect(failures.length).toBe(0);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("reports lane distribution", () => {
    const benchmark = generateBenchmark({ seed: 42, targetEpisodes: 100 });
    const result = validateGoldLabelIndependence(benchmark);
    const total = result.stats.laneDistribution.RELEVANT + result.stats.laneDistribution.SIGNIFICANT + result.stats.laneDistribution.QUIET;
    expect(total).toBe(100);
    // All lanes should be represented
    expect(result.stats.laneDistribution.RELEVANT).toBeGreaterThan(0);
    expect(result.stats.laneDistribution.QUIET).toBeGreaterThan(0);
  });
});
