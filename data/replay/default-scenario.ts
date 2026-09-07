import type { EventSubjectType, MarketEventType } from "../../src/domain/market/types";

export interface ReplayInstrument {
  id: string;
  symbol: string;
  exchange: "NSE";
  name: string;
  sector: string;
}

export interface ReplaySnapshotFixture {
  instrumentId: string;
  pricePaise: number;
  openPaise: number;
  highPaise: number;
  lowPaise: number;
  cumulativeVolume: bigint;
  expectedCumulativeVolume: bigint;
  expectedStepMoveBps: number;
}

export interface ReplayStep {
  step: number;
  sequence: number;
  eventTime: string;
  snapshots: ReplaySnapshotFixture[];
}

export interface ReplayEventFixture {
  id: string;
  sequence: number;
  instrumentId: string | null;
  type: MarketEventType;
  eventTime: string;
  subjectType: EventSubjectType;
  subjectKey: string;
  tags: string[];
  payload: Record<string, unknown>;
}

export const replayInstruments: ReplayInstrument[] = [
  { id: "NSE:TCS", symbol: "TCS", exchange: "NSE", name: "Tata Consultancy Services", sector: "Information Technology" },
  { id: "NSE:HDFCBANK", symbol: "HDFCBANK", exchange: "NSE", name: "HDFC Bank", sector: "Financial Services" },
  { id: "NSE:TATAMOTORS", symbol: "TATAMOTORS", exchange: "NSE", name: "Tata Motors", sector: "Automobiles" },
  { id: "NSE:INDIGO", symbol: "INDIGO", exchange: "NSE", name: "InterGlobe Aviation", sector: "Aviation" },
  { id: "NSE:RELIANCE", symbol: "RELIANCE", exchange: "NSE", name: "Reliance Industries", sector: "Diversified" },
];

export const defaultReplayScenario = {
  id: "groww-delta-default",
  name: "Groww Delta Default",
  timezone: "Asia/Kolkata",
  steps: [
    {
      step: 0,
      sequence: 0,
      eventTime: "2025-08-14T10:00:00+05:30",
      snapshots: [
        { instrumentId: "NSE:TCS", pricePaise: 320000, openPaise: 319500, highPaise: 320400, lowPaise: 319000, cumulativeVolume: 540000n, expectedCumulativeVolume: 560000n, expectedStepMoveBps: 35 },
        { instrumentId: "NSE:HDFCBANK", pricePaise: 158600, openPaise: 159200, highPaise: 159500, lowPaise: 158200, cumulativeVolume: 820000n, expectedCumulativeVolume: 800000n, expectedStepMoveBps: 40 },
        { instrumentId: "NSE:TATAMOTORS", pricePaise: 99500, openPaise: 99000, highPaise: 99700, lowPaise: 98800, cumulativeVolume: 1150000n, expectedCumulativeVolume: 1100000n, expectedStepMoveBps: 45 },
        { instrumentId: "NSE:INDIGO", pricePaise: 518000, openPaise: 516000, highPaise: 519000, lowPaise: 515500, cumulativeVolume: 210000n, expectedCumulativeVolume: 225000n, expectedStepMoveBps: 30 },
        { instrumentId: "NSE:RELIANCE", pricePaise: 141000, openPaise: 140500, highPaise: 141200, lowPaise: 140000, cumulativeVolume: 960000n, expectedCumulativeVolume: 940000n, expectedStepMoveBps: 80 },
      ],
    },
    {
      step: 1,
      sequence: 1,
      eventTime: "2025-08-14T10:30:00+05:30",
      snapshots: [
        { instrumentId: "NSE:TCS", pricePaise: 320600, openPaise: 319500, highPaise: 320900, lowPaise: 319000, cumulativeVolume: 890000n, expectedCumulativeVolume: 900000n, expectedStepMoveBps: 35 },
        { instrumentId: "NSE:HDFCBANK", pricePaise: 157400, openPaise: 159200, highPaise: 159500, lowPaise: 157200, cumulativeVolume: 1320000n, expectedCumulativeVolume: 1280000n, expectedStepMoveBps: 51 },
        { instrumentId: "NSE:TATAMOTORS", pricePaise: 99900, openPaise: 99000, highPaise: 100000, lowPaise: 98800, cumulativeVolume: 1850000n, expectedCumulativeVolume: 1780000n, expectedStepMoveBps: 45 },
        { instrumentId: "NSE:INDIGO", pricePaise: 517800, openPaise: 516000, highPaise: 519000, lowPaise: 515500, cumulativeVolume: 335000n, expectedCumulativeVolume: 350000n, expectedStepMoveBps: 30 },
        { instrumentId: "NSE:RELIANCE", pricePaise: 142500, openPaise: 140500, highPaise: 142800, lowPaise: 140000, cumulativeVolume: 1530000n, expectedCumulativeVolume: 1500000n, expectedStepMoveBps: 80 },
      ],
    },
    {
      step: 2,
      sequence: 2,
      eventTime: "2025-08-14T11:00:00+05:30",
      snapshots: [
        { instrumentId: "NSE:TCS", pricePaise: 321200, openPaise: 319500, highPaise: 321500, lowPaise: 319000, cumulativeVolume: 1340000n, expectedCumulativeVolume: 1320000n, expectedStepMoveBps: 35 },
        { instrumentId: "NSE:HDFCBANK", pricePaise: 156200, openPaise: 159200, highPaise: 159500, lowPaise: 156000, cumulativeVolume: 2020000n, expectedCumulativeVolume: 1900000n, expectedStepMoveBps: 40 },
        { instrumentId: "NSE:TATAMOTORS", pricePaise: 100300, openPaise: 99000, highPaise: 100500, lowPaise: 98800, cumulativeVolume: 2840000n, expectedCumulativeVolume: 1280000n, expectedStepMoveBps: 45 },
        { instrumentId: "NSE:INDIGO", pricePaise: 518100, openPaise: 516000, highPaise: 519300, lowPaise: 515500, cumulativeVolume: 510000n, expectedCumulativeVolume: 490000n, expectedStepMoveBps: 30 },
        { instrumentId: "NSE:RELIANCE", pricePaise: 144200, openPaise: 140500, highPaise: 144500, lowPaise: 140000, cumulativeVolume: 2470000n, expectedCumulativeVolume: 2150000n, expectedStepMoveBps: 80 },
      ],
    },
    {
      step: 3,
      sequence: 3,
      eventTime: "2025-08-14T11:30:00+05:30",
      snapshots: [
        { instrumentId: "NSE:TCS", pricePaise: 321800, openPaise: 319500, highPaise: 322000, lowPaise: 319000, cumulativeVolume: 1780000n, expectedCumulativeVolume: 1720000n, expectedStepMoveBps: 35 },
        { instrumentId: "NSE:HDFCBANK", pricePaise: 155800, openPaise: 159200, highPaise: 159500, lowPaise: 155500, cumulativeVolume: 2650000n, expectedCumulativeVolume: 2480000n, expectedStepMoveBps: 40 },
        { instrumentId: "NSE:TATAMOTORS", pricePaise: 100700, openPaise: 99000, highPaise: 100900, lowPaise: 98800, cumulativeVolume: 3610000n, expectedCumulativeVolume: 3300000n, expectedStepMoveBps: 45 },
        { instrumentId: "NSE:INDIGO", pricePaise: 518400, openPaise: 516000, highPaise: 519500, lowPaise: 515500, cumulativeVolume: 675000n, expectedCumulativeVolume: 640000n, expectedStepMoveBps: 30 },
        { instrumentId: "NSE:RELIANCE", pricePaise: 144300, openPaise: 140500, highPaise: 144800, lowPaise: 140000, cumulativeVolume: 3190000n, expectedCumulativeVolume: 2800000n, expectedStepMoveBps: 80 },
      ],
    },
    {
      step: 4,
      sequence: 4,
      eventTime: "2025-08-14T12:00:00+05:30",
      snapshots: [
        { instrumentId: "NSE:TCS", pricePaise: 322000, openPaise: 319500, highPaise: 322200, lowPaise: 319000, cumulativeVolume: 2160000n, expectedCumulativeVolume: 2100000n, expectedStepMoveBps: 35 },
        { instrumentId: "NSE:HDFCBANK", pricePaise: 155600, openPaise: 159200, highPaise: 159500, lowPaise: 155300, cumulativeVolume: 3190000n, expectedCumulativeVolume: 3050000n, expectedStepMoveBps: 40 },
        { instrumentId: "NSE:TATAMOTORS", pricePaise: 100800, openPaise: 99000, highPaise: 101000, lowPaise: 98800, cumulativeVolume: 4230000n, expectedCumulativeVolume: 4020000n, expectedStepMoveBps: 45 },
        { instrumentId: "NSE:INDIGO", pricePaise: 518600, openPaise: 516000, highPaise: 519500, lowPaise: 515500, cumulativeVolume: 820000n, expectedCumulativeVolume: 790000n, expectedStepMoveBps: 30 },
        { instrumentId: "NSE:RELIANCE", pricePaise: 144500, openPaise: 140500, highPaise: 144900, lowPaise: 140000, cumulativeVolume: 3760000n, expectedCumulativeVolume: 3500000n, expectedStepMoveBps: 80 },
      ],
    },
  ] satisfies ReplayStep[],
  events: [
    {
      id: "event:2:tcs:results",
      sequence: 2,
      instrumentId: "NSE:TCS",
      type: "RESULTS_PUBLISHED",
      eventTime: "2025-08-14T10:58:00+05:30",
      subjectType: "EVENT_CATEGORY",
      subjectKey: "EARNINGS",
      tags: ["EARNINGS", "MARGINS", "Q2"],
      payload: { quarterLabel: "Q2", headline: "Quarterly results published", focus: ["MARGINS"] },
    },
    {
      id: "event:2:tatamotors:breakout",
      sequence: 2,
      instrumentId: "NSE:TATAMOTORS",
      type: "TECHNICAL_TRANSITION",
      eventTime: "2025-08-14T10:59:00+05:30",
      subjectType: "METRIC",
      subjectKey: "TECHNICAL_BREAKOUT",
      tags: ["BREAKOUT", "TECHNICAL"],
      payload: { setup: "BREAKOUT", referenceLevelPaise: 100000, direction: "CROSSED_ABOVE" },
    },
    {
      id: "event:2:indigo:fuel-cost",
      sequence: 2,
      instrumentId: "NSE:INDIGO",
      type: "EXTERNAL_DRIVER",
      eventTime: "2025-08-14T10:57:00+05:30",
      subjectType: "EXTERNAL_DRIVER",
      subjectKey: "FUEL_COST",
      tags: ["FUEL_COST", "CRUDE", "AIRLINE_INPUT_COST"],
      payload: { driverKey: "FUEL_COST", externalMetric: "CRUDE", direction: "UP", magnitude: "MATERIAL" },
    },
    {
      id: "event:4:external:crude",
      sequence: 4,
      instrumentId: null,
      type: "EXTERNAL_DRIVER",
      eventTime: "2025-08-14T11:58:00+05:30",
      subjectType: "EXTERNAL_DRIVER",
      subjectKey: "CRUDE",
      tags: ["CRUDE", "FUEL_COST"],
      payload: { externalMetric: "CRUDE", direction: "UP", magnitude: "MATERIAL" },
    },
  ] satisfies ReplayEventFixture[],
} as const;

export type DefaultReplayScenario = typeof defaultReplayScenario;
