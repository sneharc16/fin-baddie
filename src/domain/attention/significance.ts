import type { MarketEventType, MarketSnapshotRecord } from "@/domain/market/types";

export const EVENT_SIGNIFICANCE: Record<MarketEventType, number> = {
  RESULTS_PUBLISHED: 90,
  CORPORATE_EVENT: 80,
  TECHNICAL_TRANSITION: 60,
  EXTERNAL_DRIVER: 60,
  NEWS_EVENT: 50,
  QUOTE_UPDATE: 0,
};

export function calculatePriceDeltaBps(baselinePricePaise: number, currentPricePaise: number): number {
  if (baselinePricePaise <= 0) return 0;
  return ((currentPricePaise - baselinePricePaise) / baselinePricePaise) * 10_000;
}

export function calculateExpectedWindowMoveBps(snapshots: MarketSnapshotRecord[], fromExclusive: number, toInclusive: number): number | null {
  const intervalSnapshots = snapshots.filter((snapshot) => snapshot.sequence > fromExclusive && snapshot.sequence <= toInclusive);
  if (intervalSnapshots.length === 0 || intervalSnapshots.some((snapshot) => snapshot.expectedStepMoveBps === null)) return null;
  const variance = intervalSnapshots.reduce((sum, snapshot) => sum + (snapshot.expectedStepMoveBps ?? 0) ** 2, 0);
  return Math.sqrt(variance);
}

export function priceSignificanceFromSurprise(priceSurprise: number): number {
  if (priceSurprise < 1) return 0;
  if (priceSurprise < 1.5) return 30;
  if (priceSurprise < 2) return 50;
  if (priceSurprise < 3) return 70;
  return 90;
}

export function priceSignificanceFromAbsoluteBps(absoluteDeltaBps: number): number {
  if (absoluteDeltaBps < 50) return 0;
  if (absoluteDeltaBps < 100) return 30;
  if (absoluteDeltaBps < 200) return 50;
  if (absoluteDeltaBps < 400) return 70;
  return 90;
}

export function calculatePriceSignificance(priceDeltaBps: number, expectedWindowMoveBps: number | null) {
  const surprise = expectedWindowMoveBps && expectedWindowMoveBps > 0
    ? Math.abs(priceDeltaBps) / expectedWindowMoveBps
    : null;
  return {
    priceSurprise: surprise,
    significance: surprise === null
      ? priceSignificanceFromAbsoluteBps(Math.abs(priceDeltaBps))
      : priceSignificanceFromSurprise(surprise),
  };
}

export function calculateVolumeRatio(snapshot: MarketSnapshotRecord): number | null {
  if (snapshot.expectedCumulativeVolume === null || snapshot.expectedCumulativeVolume <= 0n) return null;
  return Number(snapshot.cumulativeVolume) / Number(snapshot.expectedCumulativeVolume);
}

export function volumeSignificanceFromRatio(ratio: number | null): number {
  if (ratio === null || ratio < 1.3) return 0;
  if (ratio < 1.5) return 30;
  if (ratio < 2) return 50;
  if (ratio < 3) return 70;
  return 90;
}

export function combineSignificance(price: number, volume: number, event: number) {
  const nonZeroSignalCount = [price, volume, event].filter((value) => value > 0).length;
  const multipleSignals = nonZeroSignalCount >= 2;
  return {
    significance: Math.min(100, Math.max(price, volume, event) + (multipleSignals ? 10 : 0)),
    multipleSignals,
  };
}
