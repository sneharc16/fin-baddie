import { describe, expect, it } from "vitest";
import { formatINRFromPaise, formatINRLevelFromPaise, formatPercentage } from "./market";

describe("market formatting", () => {
  it("formats integer paise as INR at the presentation boundary", () => {
    expect(formatINRFromPaise(155025)).toBe("₹1,550.25");
    expect(formatINRFromPaise(320000)).toBe("₹3,200.00");
  });

  it("keeps saved whole-rupee levels compact", () => {
    expect(formatINRLevelFromPaise(155000)).toBe("₹1,550");
    expect(formatINRLevelFromPaise(155025)).toBe("₹1,550.25");
  });

  it("formats percentage direction explicitly", () => {
    expect(formatPercentage(0.4)).toBe("+0.40%");
    expect(formatPercentage(-0.4)).toBe("-0.40%");
  });
});
