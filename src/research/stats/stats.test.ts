import { describe, expect, it } from "vitest";
import {
  bootstrapCI,
  cohensD,
  interpretEffectSize,
  wilcoxonSignedRank,
  holmCorrection,
} from "./index";

describe("Bootstrap CI", () => {
  it("returns a valid CI bracket", () => {
    const values = [0.5, 0.6, 0.7, 0.8, 0.55, 0.65, 0.75, 0.85, 0.5, 0.6];
    const result = bootstrapCI(values, (vals) => vals.reduce((a, b) => a + b, 0) / vals.length, 1000, 42);
    expect(result.ci95[0]).toBeLessThan(result.ci95[1]);
    expect(result.pointEstimate).toBeCloseTo(0.66, 1);
    expect(result.se).toBeGreaterThan(0);
  });

  it("returns [0,0] for empty input", () => {
    const result = bootstrapCI([], (vals) => vals.length > 0 ? vals[0] : 0);
    expect(result.ci95).toEqual([0, 0]);
    expect(result.se).toBe(0);
  });

  it("CI contains the point estimate", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = bootstrapCI(values, (vals) => vals.reduce((a, b) => a + b, 0) / vals.length, 1000, 42);
    expect(result.ci95[0]).toBeLessThanOrEqual(result.pointEstimate);
    expect(result.ci95[1]).toBeGreaterThanOrEqual(result.pointEstimate);
  });
});

describe("Cohen's d", () => {
  it("returns 0 for identical distributions", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 3, 4, 5];
    expect(cohensD(a, b)).toBe(0);
  });

  it("returns positive value when A > B on average (paired)", () => {
    // Paired: each a[i] > b[i] by varying amounts so diffs have nonzero variance
    const a = [10, 12, 14, 16, 18];
    const b = [1, 2, 3, 4, 5];
    // diffs = [9, 10, 11, 12, 13], mean=11, variance>0
    expect(cohensD(a, b)).toBeGreaterThan(0);
  });

  it("returns negative value when A < B on average (paired)", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [10, 12, 14, 16, 18];
    // diffs = [-9, -10, -11, -12, -13], mean=-11, variance>0
    expect(cohensD(a, b)).toBeLessThan(0);
  });

  it("returns 0 for empty input", () => {
    expect(cohensD([], [])).toBe(0);
  });

  it("handles different length inputs", () => {
    expect(cohensD([1], [1, 2])).toBe(0);
  });
});

describe("Effect size interpretation", () => {
  it("interprets small effect", () => {
    expect(interpretEffectSize(0.3)).toBe("small");
  });

  it("interprets large effect", () => {
    expect(interpretEffectSize(1.2)).toBe("large");
  });

  it("interprets negligible effect", () => {
    expect(interpretEffectSize(0.1)).toBe("negligible");
  });

  it("interprets medium effect", () => {
    expect(interpretEffectSize(0.6)).toBe("medium");
  });
});

describe("Wilcoxon signed-rank test", () => {
  it("returns high p-value for identical distributions", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = wilcoxonSignedRank(a, b);
    expect(result.pValue).toBeGreaterThan(0.05);
  });

  it("returns low p-value for very different distributions", () => {
    const a = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const b = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    const result = wilcoxonSignedRank(a, b);
    expect(result.pValue).toBeLessThan(0.05);
  });

  it("returns p=1 for all zero differences", () => {
    const a = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    const b = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    const result = wilcoxonSignedRank(a, b);
    expect(result.pValue).toBe(1);
  });

  it("returns p=1 for too few samples", () => {
    const result = wilcoxonSignedRank([1], [2]);
    expect(result.pValue).toBe(1);
  });
});

describe("Holm-Bonferroni correction", () => {
  it("marks significant tests correctly", () => {
    const tests = [
      { name: "a", pValue: 0.01 },
      { name: "b", pValue: 0.03 },
      { name: "c", pValue: 0.08 },
      { name: "d", pValue: 0.10 },
    ];

    const corrected = holmCorrection(tests, 0.05);
    // m=4: thresholds are 0.05/4=0.0125, 0.05/3=0.0167, 0.05/2=0.025, 0.05/1=0.05
    expect(corrected[0].significant).toBe(true); // 0.01 <= 0.0125
    expect(corrected[1].significant).toBe(false); // 0.03 > 0.0167
    expect(corrected[2].significant).toBe(false);
    expect(corrected[3].significant).toBe(false);
  });

  it("sorts tests by p-value ascending", () => {
    const tests = [
      { name: "c", pValue: 0.10 },
      { name: "a", pValue: 0.01 },
      { name: "b", pValue: 0.05 },
    ];
    const corrected = holmCorrection(tests, 0.05);
    expect(corrected[0].name).toBe("a");
    expect(corrected[1].name).toBe("b");
    expect(corrected[2].name).toBe("c");
  });

  it("returns adjusted alpha values", () => {
    const tests = [
      { name: "a", pValue: 0.01 },
      { name: "b", pValue: 0.03 },
    ];
    const corrected = holmCorrection(tests, 0.05);
    expect(corrected[0].adjustedAlpha).toBeCloseTo(0.025); // 0.05/2
    expect(corrected[1].adjustedAlpha).toBeCloseTo(0.05); // 0.05/1
  });
});
