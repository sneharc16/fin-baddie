import { describe, expect, it } from "vitest";
import { watchIntentInputSchema } from "./schemas";

describe("WatchIntent payload validation", () => {
  it("accepts each payload only through its discriminated intent type", () => {
    const result = watchIntentInputSchema.parse({
      type: "PRICE_LEVEL",
      originalText: "Watching near ₹1,550",
      provenanceSource: "MANUAL",
      structuredPayload: { targetPricePaise: 155000, mode: "NEAR" },
    });
    expect(result.type).toBe("PRICE_LEVEL");
    if (result.type === "PRICE_LEVEL") expect(result.structuredPayload.proximityBps).toBe(100);
  });

  it("rejects invalid PRICE_LEVEL values", () => {
    expect(() => watchIntentInputSchema.parse({
      type: "PRICE_LEVEL",
      provenanceSource: "MANUAL",
      structuredPayload: { targetPricePaise: 1550.5, mode: "SOMEWHERE" },
    })).toThrow();
  });

  it("rejects a payload shape belonging to another intent type", () => {
    expect(() => watchIntentInputSchema.parse({
      type: "EARNINGS",
      provenanceSource: "MANUAL",
      structuredPayload: { targetPricePaise: 155000, mode: "NEAR" },
    })).toThrow();
  });
});
