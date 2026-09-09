// ─────────────────────────────────────────────────────────────────────────────
// Benchmark: Scenario Definitions
// 40 scenarios across 8 categories, covering all V3 attention lanes.
// ─────────────────────────────────────────────────────────────────────────────

import type { ScenarioDefinition, GraphConfig, IntentConfig, EventGenerator } from "../types";
import type { InstrumentRecord } from "@/domain/instrument/types";

// ── Instruments ─────────────────────────────────────────────────────────────

const INSTRUMENTS: InstrumentRecord[] = [
  { id: "NSE:TCS", symbol: "TCS", exchange: "NSE", name: "Tata Consultancy Services", sector: "IT", currency: "INR", isActive: true },
  { id: "NSE:INFY", symbol: "INFY", exchange: "NSE", name: "Infosys", sector: "IT", currency: "INR", isActive: true },
  { id: "NSE:HDFCBANK", symbol: "HDFCBANK", exchange: "NSE", name: "HDFC Bank", sector: "BANKING", currency: "INR", isActive: true },
  { id: "NSE:ICICIBANK", symbol: "ICICIBANK", exchange: "NSE", name: "ICICI Bank", sector: "BANKING", currency: "INR", isActive: true },
  { id: "NSE:INDIGO", symbol: "INDIGO", exchange: "NSE", name: "IndiGo", sector: "AVIATION", currency: "INR", isActive: true },
  { id: "NSE:TATAMOTORS", symbol: "TATAMOTORS", exchange: "NSE", name: "Tata Motors", sector: "AUTO", currency: "INR", isActive: true },
  { id: "NSE:RELIANCE", symbol: "RELIANCE", exchange: "NSE", name: "Reliance Industries", sector: "ENERGY", currency: "INR", isActive: true },
  { id: "NSE:SBIN", symbol: "SBIN", exchange: "NSE", name: "State Bank of India", sector: "BANKING", currency: "INR", isActive: true },
  { id: "NSE:WIPRO", symbol: "WIPRO", exchange: "NSE", name: "Wipro", sector: "IT", currency: "INR", isActive: true },
  { id: "NSE:ITC", symbol: "ITC", exchange: "NSE", name: "ITC", sector: "FMCG", currency: "INR", isActive: true },
];

// ── Helper: Intent Configs ──────────────────────────────────────────────────

function earningsIntent(logicalId: string, focus: string[], quarter = "Q2", effSeq = 0): IntentConfig {
  return {
    logicalIntentId: logicalId,
    type: "EARNINGS",
    structuredPayload: { focus, quarterLabel: quarter },
    originalText: `Watching Q2 ${focus[0].toLowerCase()} results`,
    effectiveFromSequence: effSeq,
    version: 1,
  };
}

function priceIntent(logicalId: string, targetPaise: number, mode: "NEAR" | "ABOVE" | "BELOW", effSeq = 0): IntentConfig {
  return {
    logicalIntentId: logicalId,
    type: "PRICE_LEVEL",
    structuredPayload: { targetPricePaise: targetPaise, mode, proximityBps: 100 },
    originalText: `Watching price ${mode.toLowerCase()} ₹${(targetPaise / 100).toFixed(0)}`,
    effectiveFromSequence: effSeq,
    version: 1,
  };
}

function technicalIntent(logicalId: string, setup: "BREAKOUT" | "SUPPORT" | "MOVING_AVERAGE", effSeq = 0): IntentConfig {
  return {
    logicalIntentId: logicalId,
    type: "TECHNICAL",
    structuredPayload: { setup },
    originalText: `Watching ${setup.toLowerCase()} setup`,
    effectiveFromSequence: effSeq,
    version: 1,
  };
}

function driverIntent(logicalId: string, driverKey: string, effSeq = 0): IntentConfig {
  return {
    logicalIntentId: logicalId,
    type: "DRIVER",
    structuredPayload: { driverKey, description: `Watching ${driverKey}` },
    originalText: `Watching ${driverKey} driver`,
    effectiveFromSequence: effSeq,
    version: 1,
  };
}

function dividendIntent(logicalId: string, focus: "EX_DATE" | "ANNOUNCEMENT" | "YIELD" | "GENERAL" = "EX_DATE", effSeq = 0): IntentConfig {
  return {
    logicalIntentId: logicalId,
    type: "DIVIDEND",
    structuredPayload: { focus },
    originalText: `Watching dividend ${focus.toLowerCase()}`,
    effectiveFromSequence: effSeq,
    version: 1,
  };
}

function companyEventIntent(logicalId: string, eventKind: string, effSeq = 0): IntentConfig {
  return {
    logicalIntentId: logicalId,
    type: "COMPANY_EVENT",
    structuredPayload: { eventKind },
    originalText: `Watching ${eventKind}`,
    effectiveFromSequence: effSeq,
    version: 1,
  };
}

function generalIntent(logicalId: string, note: string, effSeq = 0): IntentConfig {
  return {
    logicalIntentId: logicalId,
    type: "GENERAL",
    structuredPayload: { note },
    originalText: note,
    effectiveFromSequence: effSeq,
    version: 1,
  };
}

// ── Helper: Graph Configs ───────────────────────────────────────────────────

const GRAPH_AIRLINE_FUEL: GraphConfig = {
  nodes: [
    { nodeKey: "NSE:INDIGO", type: "INSTRUMENT", label: "IndiGo" },
    { nodeKey: "FUEL_COST", type: "DRIVER", label: "Fuel cost" },
    { nodeKey: "CRUDE", type: "EXTERNAL_DRIVER", label: "Crude" },
    { nodeKey: "USDINR", type: "EXTERNAL_DRIVER", label: "USD/INR" },
  ],
  edges: [
    { fromKey: "NSE:INDIGO", toKey: "FUEL_COST", relationship: "RELATES_TO", weight: 100 },
    { fromKey: "FUEL_COST", toKey: "CRUDE", relationship: "AFFECTED_BY", weight: 85 },
    { fromKey: "FUEL_COST", toKey: "USDINR", relationship: "CONTEXT_FOR", weight: 70 },
  ],
};

const GRAPH_BANK_ASSET: GraphConfig = {
  nodes: [
    { nodeKey: "NSE:HDFCBANK", type: "INSTRUMENT", label: "HDFC Bank" },
    { nodeKey: "ASSET_QUALITY", type: "METRIC", label: "Asset quality" },
    { nodeKey: "EARNINGS", type: "EVENT_CATEGORY", label: "Earnings" },
  ],
  edges: [
    { fromKey: "NSE:HDFCBANK", toKey: "ASSET_QUALITY", relationship: "MEASURED_BY", weight: 100 },
    { fromKey: "ASSET_QUALITY", toKey: "EARNINGS", relationship: "CONTEXT_FOR", weight: 90 },
  ],
};

const GRAPH_IT_MARGIN: GraphConfig = {
  nodes: [
    { nodeKey: "NSE:TCS", type: "INSTRUMENT", label: "TCS" },
    { nodeKey: "OPERATING_MARGIN", type: "METRIC", label: "Operating margin" },
    { nodeKey: "EARNINGS", type: "EVENT_CATEGORY", label: "Earnings" },
  ],
  edges: [
    { fromKey: "NSE:TCS", toKey: "OPERATING_MARGIN", relationship: "MEASURED_BY", weight: 100 },
    { fromKey: "OPERATING_MARGIN", toKey: "EARNINGS", relationship: "CONTEXT_FOR", weight: 90 },
  ],
};

const GRAPH_AUTO_BREAKOUT: GraphConfig = {
  nodes: [
    { nodeKey: "NSE:TATAMOTORS", type: "INSTRUMENT", label: "Tata Motors" },
    { nodeKey: "TECHNICAL_BREAKOUT", type: "METRIC", label: "Technical breakout" },
    { nodeKey: "VOLUME", type: "DRIVER", label: "Volume" },
  ],
  edges: [
    { fromKey: "NSE:TATAMOTORS", toKey: "TECHNICAL_BREAKOUT", relationship: "WATCHES", weight: 100 },
    { fromKey: "TECHNICAL_BREAKOUT", toKey: "VOLUME", relationship: "MEASURED_BY", weight: 80 },
  ],
};

// ── Event Generators ────────────────────────────────────────────────────────

function earningsEvent(step: number, instrumentId: string | null, focus: string[], quarter: string): EventGenerator {
  return {
    step,
    type: "RESULTS_PUBLISHED",
    payload: () => ({ focus, quarterLabel: quarter, magnitude: "MATERIAL" }),
    subjectType: "INSTRUMENT",
    subjectKey: instrumentId,
    tags: [],
    quality: "FRESH",
  };
}

function corporateEvent(step: number, eventKind: string, stage?: string): EventGenerator {
  return {
    step,
    type: "CORPORATE_EVENT",
    payload: () => ({ eventKind, stage, magnitude: "MATERIAL" }),
    subjectType: "INSTRUMENT",
    subjectKey: null,
    tags: [],
    quality: "FRESH",
  };
}

function externalDriverEvent(step: number, driverKey: string, magnitude = "MATERIAL"): EventGenerator {
  return {
    step,
    type: "EXTERNAL_DRIVER",
    payload: () => ({ externalMetric: driverKey, magnitude }),
    subjectType: "EXTERNAL_DRIVER",
    subjectKey: driverKey,
    tags: [driverKey],
    quality: "FRESH",
  };
}

function technicalEvent(step: number, setup: string, refLevel?: number): EventGenerator {
  return {
    step,
    type: "TECHNICAL_TRANSITION",
    payload: () => ({ setup, referenceLevelPaise: refLevel, magnitude: "MATERIAL" }),
    subjectType: "INSTRUMENT",
    subjectKey: null,
    tags: [],
    quality: "FRESH",
  };
}

function newsEvent(step: number, headline: string): EventGenerator {
  return {
    step,
    type: "NEWS_EVENT",
    payload: () => ({ headline, magnitude: "MATERIAL" }),
    subjectType: "INSTRUMENT",
    subjectKey: null,
    tags: [],
    quality: "FRESH",
  };
}

// ── Scenario Definitions ────────────────────────────────────────────────────

function defineScenarios(): ScenarioDefinition[] {
  const scenarios: ScenarioDefinition[] = [];

  // ── CATEGORY: EARNINGS (8 scenarios) ────────────────────────────────────

  scenarios.push({
    key: "EARNINGS_MISS_TCS",
    category: "EARNINGS",
    instrument: INSTRUMENTS[0], // TCS
    steps: 8,
    basePricePaise: 350000,
    eventGenerators: [earningsEvent(4, "NSE:TCS", ["MARGINS", "REVENUE"], "Q2")],
    intentConfigs: [earningsIntent("tcs-margins", ["MARGINS"], "Q2")],
    graphConfig: GRAPH_IT_MARGIN,
    goldConfig: {
      stepRelevance: { 4: 100, 5: 90, 6: 70, 7: 50 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT" },
      relevantSteps: [4, 5, 6, 7],
      rationale: "Q2 earnings published with margin and revenue focus, directly matching active earnings watch.",
    },
  });

  scenarios.push({
    key: "EARNINGS_BEAT_INFY",
    category: "EARNINGS",
    instrument: INSTRUMENTS[1], // INFY
    steps: 10,
    basePricePaise: 160000,
    eventGenerators: [earningsEvent(6, "NSE:INFY", ["REVENUE", "PROFIT"], "Q2")],
    intentConfigs: [earningsIntent("infy-results", ["REVENUE"], "Q2")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 6: 100, 7: 95, 8: 80, 9: 60 },
      stepLane: { 6: "RELEVANT", 7: "RELEVANT", 8: "RELEVANT", 9: "RELEVANT" },
      relevantSteps: [6, 7, 8, 9],
      rationale: "Q2 results published for Infosys, matching active revenue watch intent.",
    },
  });

  scenarios.push({
    key: "EARNINGS_HDFC_ASSET_QUALITY",
    category: "EARNINGS",
    instrument: INSTRUMENTS[2], // HDFCBANK
    steps: 10,
    basePricePaise: 170000,
    eventGenerators: [earningsEvent(6, "NSE:HDFCBANK", ["ASSET_QUALITY", "ALL_KEY_CHANGES"], "Q2")],
    intentConfigs: [earningsIntent("hdfc-asset", ["ASSET_QUALITY"], "Q2")],
    graphConfig: GRAPH_BANK_ASSET,
    goldConfig: {
      stepRelevance: { 6: 100, 7: 95, 8: 85, 9: 70 },
      stepLane: { 6: "RELEVANT", 7: "RELEVANT", 8: "RELEVANT", 9: "RELEVANT" },
      relevantSteps: [6, 7, 8, 9],
      rationale: "HDFC Bank earnings with asset quality data, matching graph-connected intent.",
    },
  });

  scenarios.push({
    key: "EARNINGS_WRONG_QUARTER_WIPRO",
    category: "EARNINGS",
    instrument: INSTRUMENTS[8], // WIPRO
    steps: 8,
    basePricePaise: 450000,
    eventGenerators: [earningsEvent(4, "NSE:WIPRO", ["MARGINS"], "Q3")],
    intentConfigs: [earningsIntent("wipro-margins", ["MARGINS"], "Q2")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 20, 5: 15, 6: 10, 7: 5 },
      stepLane: { 4: "QUIET", 5: "QUIET", 6: "QUIET", 7: "QUIET" },
      relevantSteps: [],
      rationale: "Q3 results published but intent watches Q2 — no match. Slight significance from price move but below threshold.",
    },
  });

  scenarios.push({
    key: "EARNINGS_RESULTS_ALL_FOCUS",
    category: "EARNINGS",
    instrument: INSTRUMENTS[3], // ICICIBANK
    steps: 10,
    basePricePaise: 120000,
    eventGenerators: [earningsEvent(5, "NSE:ICICIBANK", ["REVENUE", "PROFIT", "MARGINS"], "Q2")],
    intentConfigs: [earningsIntent("icici-results", ["REVENUE", "ALL_KEY_CHANGES"], "Q2")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 5: 100, 6: 90, 7: 75, 8: 55, 9: 40 },
      stepLane: { 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT", 8: "SIGNIFICANT", 9: "QUIET" },
      relevantSteps: [5, 6, 7, 8],
      rationale: "ICICI results with ALL_KEY_CHANGES matching broad revenue intent.",
    },
  });

  scenarios.push({
    key: "EARNINGS_LARGE_PRICE_MOVE_TCS",
    category: "EARNINGS",
    instrument: INSTRUMENTS[0], // TCS
    steps: 10,
    basePricePaise: 350000,
    eventGenerators: [earningsEvent(5, "NSE:TCS", ["PROFIT"], "Q2")],
    intentConfigs: [], // No active intent
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 5: 60, 6: 55, 7: 45, 8: 35, 9: 25 },
      stepLane: { 5: "SIGNIFICANT", 6: "SIGNIFICANT", 7: "QUIET", 8: "QUIET", 9: "QUIET" },
      relevantSteps: [5, 6],
      rationale: "Earnings published with no matching intent, but results are objectively significant.",
    },
  });

  scenarios.push({
    key: "EARNINGS_GRAPH_INDIGO_FUEL",
    category: "EARNINGS",
    instrument: INSTRUMENTS[4], // INDIGO
    steps: 10,
    basePricePaise: 450000,
    eventGenerators: [earningsEvent(6, "NSE:INDIGO", ["REVENUE", "MARGINS"], "Q2")],
    intentConfigs: [driverIntent("indigo-fuel", "FUEL_COST")],
    graphConfig: GRAPH_AIRLINE_FUEL,
    goldConfig: {
      stepRelevance: { 6: 70, 7: 65, 8: 50, 9: 35 },
      stepLane: { 6: "SIGNIFICANT", 7: "SIGNIFICANT", 8: "SIGNIFICANT", 9: "QUIET" },
      relevantSteps: [6, 7, 8],
      rationale: "Earnings event is significant but doesn't directly match fuel driver intent — graph connected but no driver event fires.",
    },
  });

  scenarios.push({
    key: "EARNINGS_PROMISING_MARGINS",
    category: "EARNINGS",
    instrument: INSTRUMENTS[9], // ITC
    steps: 8,
    basePricePaise: 46000,
    eventGenerators: [earningsEvent(4, "NSE:ITC", ["MARGINS", "PROFIT"], "Q2")],
    intentConfigs: [earningsIntent("itc-margins", ["MARGINS"], "Q2")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 100, 5: 85, 6: 65, 7: 45 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "QUIET" },
      relevantSteps: [4, 5, 6],
      rationale: "ITC earnings with margin focus matching intent.",
    },
  });

  // ── CATEGORY: PRICE_LEVEL (8 scenarios) ────────────────────────────────

  scenarios.push({
    key: "PRICE_CROSSED_ABOVE_SBIN",
    category: "PRICE_LEVEL",
    instrument: INSTRUMENTS[7], // SBIN
    steps: 8,
    basePricePaise: 80000,
    eventGenerators: [],
    intentConfigs: [priceIntent("sbin-above", 81000, "ABOVE")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 3: 100, 4: 90, 5: 75, 6: 60, 7: 50 },
      stepLane: { 3: "RELEVANT", 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT" },
      relevantSteps: [3, 4, 5, 6, 7],
      rationale: "Price crossed above ₹810 target — exactly matching the ABOVE intent.",
    },
  });

  scenarios.push({
    key: "PRICE_NEAR_ZONE_REL",
    category: "PRICE_LEVEL",
    instrument: INSTRUMENTS[6], // RELIANCE
    steps: 10,
    basePricePaise: 280000,
    eventGenerators: [],
    intentConfigs: [priceIntent("rel-near", 283000, "NEAR")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 7: 100, 8: 85, 9: 70 },
      stepLane: { 7: "RELEVANT", 8: "RELEVANT", 9: "RELEVANT" },
      relevantSteps: [7, 8, 9],
      rationale: "Price entered the NEAR proximity zone around ₹2830.",
    },
  });

  scenarios.push({
    key: "PRICE_CROSSED_BELOW_HDFC",
    category: "PRICE_LEVEL",
    instrument: INSTRUMENTS[2], // HDFCBANK
    steps: 10,
    basePricePaise: 170000,
    eventGenerators: [],
    intentConfigs: [priceIntent("hdfc-below", 168000, "BELOW")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 6: 100, 7: 90, 8: 80, 9: 65 },
      stepLane: { 6: "RELEVANT", 7: "RELEVANT", 8: "RELEVANT", 9: "RELEVANT" },
      relevantSteps: [6, 7, 8, 9],
      rationale: "HDFC price dropped below ₹1680 support level.",
    },
  });

  scenarios.push({
    key: "PRICE_NO_MATCH_CLOSE",
    category: "PRICE_LEVEL",
    instrument: INSTRUMENTS[0], // TCS
    steps: 8,
    basePricePaise: 350000,
    eventGenerators: [],
    intentConfigs: [priceIntent("tcs-target", 360000, "ABOVE")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      stepLane: { 0: "QUIET", 1: "QUIET", 2: "QUIET", 3: "QUIET", 4: "QUIET", 5: "QUIET", 6: "QUIET", 7: "QUIET" },
      relevantSteps: [],
      rationale: "TCS price approaching but never crossing ₹360 target — no intent match.",
    },
  });

  scenarios.push({
    key: "PRICE_LARGE_MOVE_NO_INTENT",
    category: "PRICE_LEVEL",
    instrument: INSTRUMENTS[1], // INFY
    steps: 8,
    basePricePaise: 160000,
    eventGenerators: [],
    intentConfigs: [],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 5: 60, 6: 55, 7: 40 },
      stepLane: { 5: "SIGNIFICANT", 6: "SIGNIFICANT", 7: "QUIET" },
      relevantSteps: [5, 6],
      rationale: "Infosys has a large surprise price move (3σ+) with no matching intent — objectively significant.",
    },
  });

  scenarios.push({
    key: "PRICE_GRAPH_TATA_BREAKOUT",
    category: "PRICE_LEVEL",
    instrument: INSTRUMENTS[5], // TATAMOTORS
    steps: 10,
    basePricePaise: 95000,
    eventGenerators: [technicalEvent(5, "BREAKOUT", 100000)],
    intentConfigs: [technicalIntent("tata-breakout", "BREAKOUT")],
    graphConfig: GRAPH_AUTO_BREAKOUT,
    goldConfig: {
      stepRelevance: { 5: 100, 6: 90, 7: 75, 8: 60, 9: 50 },
      stepLane: { 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT", 8: "RELEVANT", 9: "RELEVANT" },
      relevantSteps: [5, 6, 7, 8, 9],
      rationale: "Tata Motors breakout at ₹1000 — matches technical intent with graph support.",
    },
  });

  scenarios.push({
    key: "PRICE_STALE_DATA",
    category: "PRICE_LEVEL",
    instrument: INSTRUMENTS[3], // ICICIBANK
    steps: 8,
    basePricePaise: 120000,
    eventGenerators: [],
    intentConfigs: [priceIntent("icici-cross", 125000, "ABOVE")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      stepLane: { 0: "QUIET", 1: "QUIET", 2: "QUIET", 3: "QUIET", 4: "QUIET", 5: "QUIET", 6: "QUIET", 7: "QUIET" },
      relevantSteps: [],
      rationale: "ICICI price near ₹125 but never crosses — stale data quality prevents confirmation.",
    },
  });

  scenarios.push({
    key: "PRICE_DOUBLE_INTENT",
    category: "PRICE_LEVEL",
    instrument: INSTRUMENTS[7], // SBIN
    steps: 10,
    basePricePaise: 80000,
    eventGenerators: [],
    intentConfigs: [
      priceIntent("sbin-above", 81000, "ABOVE"),
      priceIntent("sbin-near", 82000, "NEAR"),
    ],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 100, 5: 100, 6: 90, 7: 80, 8: 70, 9: 60 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT", 8: "RELEVANT", 9: "RELEVANT" },
      relevantSteps: [4, 5, 6, 7, 8, 9],
      rationale: "SBIN crosses ₹81 (ABOVE match) then enters ₹82 NEAR zone — both intents fire.",
    },
  });

  // ── CATEGORY: TECHNICAL (4 scenarios) ───────────────────────────────────

  scenarios.push({
    key: "TECH_BREAKOUT_TATA",
    category: "TECHNICAL",
    instrument: INSTRUMENTS[5], // TATAMOTORS
    steps: 8,
    basePricePaise: 95000,
    eventGenerators: [technicalEvent(4, "BREAKOUT", 100000)],
    intentConfigs: [technicalIntent("tata-bo", "BREAKOUT")],
    graphConfig: GRAPH_AUTO_BREAKOUT,
    goldConfig: {
      stepRelevance: { 4: 100, 5: 90, 6: 75, 7: 60 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT" },
      relevantSteps: [4, 5, 6, 7],
      rationale: "Technical breakout event at ₹1000, matching technical intent.",
    },
  });

  scenarios.push({
    key: "TECH_SUPPORT_TCS",
    category: "TECHNICAL",
    instrument: INSTRUMENTS[0], // TCS
    steps: 8,
    basePricePaise: 350000,
    eventGenerators: [technicalEvent(3, "SUPPORT", 340000)],
    intentConfigs: [technicalIntent("tcs-support", "SUPPORT")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 3: 100, 4: 85, 5: 70, 6: 55, 7: 40 },
      stepLane: { 3: "RELEVANT", 4: "RELEVANT", 5: "RELEVANT", 6: "SIGNIFICANT", 7: "QUIET" },
      relevantSteps: [3, 4, 5, 6],
      rationale: "TCS support level at ₹3400 touched — matching technical support intent.",
    },
  });

  scenarios.push({
    key: "TECH_NO_MATCH_SETUP",
    category: "TECHNICAL",
    instrument: INSTRUMENTS[1], // INFY
    steps: 8,
    basePricePaise: 160000,
    eventGenerators: [technicalEvent(4, "MOVING_AVERAGE", 162000)],
    intentConfigs: [technicalIntent("infy-bo", "BREAKOUT")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 15, 5: 10, 6: 5, 7: 0 },
      stepLane: { 4: "QUIET", 5: "QUIET", 6: "QUIET", 7: "QUIET" },
      relevantSteps: [],
      rationale: "MOVING_AVERAGE event but intent watches BREAKOUT — no match. Minor significance.",
    },
  });

  scenarios.push({
    key: "TECH_MA_TATAMOTORS",
    category: "TECHNICAL",
    instrument: INSTRUMENTS[5],
    steps: 10,
    basePricePaise: 95000,
    eventGenerators: [technicalEvent(5, "MOVING_AVERAGE", 97000)],
    intentConfigs: [technicalIntent("tata-ma", "MOVING_AVERAGE")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 5: 100, 6: 85, 7: 70, 8: 55, 9: 40 },
      stepLane: { 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT", 8: "SIGNIFICANT", 9: "QUIET" },
      relevantSteps: [5, 6, 7, 8],
      rationale: "Moving average crossover event at ₹970 matching MA watch intent.",
    },
  });

  // ── CATEGORY: DRIVER (6 scenarios) ─────────────────────────────────────

  scenarios.push({
    key: "DRIVER_CRUDE_INDIGO",
    category: "DRIVER",
    instrument: INSTRUMENTS[4], // INDIGO
    steps: 10,
    basePricePaise: 450000,
    eventGenerators: [externalDriverEvent(5, "CRUDE", "MATERIAL")],
    intentConfigs: [driverIntent("indigo-fuel", "FUEL_COST")],
    graphConfig: GRAPH_AIRLINE_FUEL,
    goldConfig: {
      stepRelevance: { 5: 100, 6: 90, 7: 75, 8: 60, 9: 45 },
      stepLane: { 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT", 8: "RELEVANT", 9: "QUIET" },
      relevantSteps: [5, 6, 7, 8],
      rationale: "Crude price material move, graph-connected to IndiGo fuel cost intent.",
    },
  });

  scenarios.push({
    key: "DRIVER_CRUDE_NO_GRAPH",
    category: "DRIVER",
    instrument: INSTRUMENTS[4], // INDIGO
    steps: 8,
    basePricePaise: 450000,
    eventGenerators: [externalDriverEvent(4, "CRUDE", "MATERIAL")],
    intentConfigs: [driverIntent("indigo-fuel", "FUEL_COST")],
    graphConfig: null, // No graph!
    goldConfig: {
      stepRelevance: { 4: 25, 5: 20, 6: 15, 7: 10 },
      stepLane: { 4: "QUIET", 5: "QUIET", 6: "QUIET", 7: "QUIET" },
      relevantSteps: [],
      rationale: "Crude event fires but without graph, no path connects it to the fuel cost intent — only significance from crude itself.",
    },
  });

  scenarios.push({
    key: "DRIVER_USDINR_WEAK",
    category: "DRIVER",
    instrument: INSTRUMENTS[4], // INDIGO
    steps: 10,
    basePricePaise: 450000,
    eventGenerators: [externalDriverEvent(6, "USDINR", "MODERATE")],
    intentConfigs: [driverIntent("indigo-fuel", "FUEL_COST")],
    graphConfig: GRAPH_AIRLINE_FUEL,
    goldConfig: {
      stepRelevance: { 6: 70, 7: 60, 8: 45, 9: 30 },
      stepLane: { 6: "RELEVANT", 7: "RELEVANT", 8: "QUIET", 9: "QUIET" },
      relevantSteps: [6, 7],
      rationale: "USDINR moderate move, graph-connected through fuel cost to IndiGo. Lower relevance due to weaker edge weight (70).",
    },
  });

  scenarios.push({
    key: "DRIVER_STALE_EVENT",
    category: "DRIVER",
    instrument: INSTRUMENTS[4],
    steps: 8,
    basePricePaise: 450000,
    eventGenerators: [{ ...externalDriverEvent(4, "CRUDE"), quality: "STALE" }],
    intentConfigs: [driverIntent("indigo-fuel", "FUEL_COST")],
    graphConfig: GRAPH_AIRLINE_FUEL,
    goldConfig: {
      stepRelevance: { 4: 10, 5: 5, 6: 0, 7: 0 },
      stepLane: { 4: "QUIET", 5: "QUIET", 6: "QUIET", 7: "QUIET" },
      relevantSteps: [],
      rationale: "Crude event is STALE — blocked by graph traversal quality filter. Should not surface.",
    },
  });

  scenarios.push({
    key: "DRIVER_UNRELATED_DRIVER",
    category: "DRIVER",
    instrument: INSTRUMENTS[6], // RELIANCE
    steps: 8,
    basePricePaise: 280000,
    eventGenerators: [externalDriverEvent(4, "NATURAL_GAS", "MATERIAL")],
    intentConfigs: [driverIntent("rel-gas", "NATURAL_GAS")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 100, 5: 85, 6: 70, 7: 55 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "SIGNIFICANT" },
      relevantSteps: [4, 5, 6, 7],
      rationale: "Natural gas driver material move matching Reliance intent — direct match.",
    },
  });

  scenarios.push({
    key: "DRIVER_MULTI_DRIVER_GRAPH",
    category: "DRIVER",
    instrument: INSTRUMENTS[4],
    steps: 10,
    basePricePaise: 450000,
    eventGenerators: [
      externalDriverEvent(4, "CRUDE", "MATERIAL"),
      externalDriverEvent(6, "USDINR", "MATERIAL"),
    ],
    intentConfigs: [driverIntent("indigo-fuel", "FUEL_COST")],
    graphConfig: GRAPH_AIRLINE_FUEL,
    goldConfig: {
      stepRelevance: { 4: 100, 5: 95, 6: 100, 7: 90, 8: 75, 9: 55 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT", 8: "RELEVANT", 9: "SIGNIFICANT" },
      relevantSteps: [4, 5, 6, 7, 8],
      rationale: "Both crude and USDINR fire — two graph paths to fuel cost. High relevance sustained.",
    },
  });

  // ── CATEGORY: DIVIDEND (4 scenarios) ───────────────────────────────────

  scenarios.push({
    key: "DIVIDEND_EX_DATE_ITC",
    category: "DIVIDEND",
    instrument: INSTRUMENTS[9], // ITC
    steps: 8,
    basePricePaise: 46000,
    eventGenerators: [corporateEvent(4, "DIVIDEND", "EX_DATE")],
    intentConfigs: [dividendIntent("itc-div", "EX_DATE")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 100, 5: 85, 6: 70, 7: 50 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT" },
      relevantSteps: [4, 5, 6, 7],
      rationale: "ITC dividend ex-date event matching the dividend watch intent.",
    },
  });

  scenarios.push({
    key: "DIVIDEND_ANNOUNCEMENT_TCS",
    category: "DIVIDEND",
    instrument: INSTRUMENTS[0],
    steps: 8,
    basePricePaise: 350000,
    eventGenerators: [corporateEvent(3, "DIVIDEND", "ANNOUNCEMENT")],
    intentConfigs: [dividendIntent("tcs-div", "ANNOUNCEMENT")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 3: 100, 4: 85, 5: 70, 6: 55, 7: 40 },
      stepLane: { 3: "RELEVANT", 4: "RELEVANT", 5: "RELEVANT", 6: "SIGNIFICANT", 7: "QUIET" },
      relevantSteps: [3, 4, 5, 6],
      rationale: "TCS dividend announcement matching dividend watch intent.",
    },
  });

  scenarios.push({
    key: "DIVIDEND_STAGE_MISMATCH",
    category: "DIVIDEND",
    instrument: INSTRUMENTS[9],
    steps: 8,
    basePricePaise: 46000,
    eventGenerators: [corporateEvent(4, "DIVIDEND", "ANNOUNCEMENT")],
    intentConfigs: [dividendIntent("itc-ex", "EX_DATE")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 30, 5: 25, 6: 15, 7: 10 },
      stepLane: { 4: "QUIET", 5: "QUIET", 6: "QUIET", 7: "QUIET" },
      relevantSteps: [],
      rationale: "Dividend announcement but intent watches EX_DATE specifically — no match. Minor event significance.",
    },
  });

  scenarios.push({
    key: "DIVIDEND_GENERAL_FOCUS",
    category: "DIVIDEND",
    instrument: INSTRUMENTS[3], // ICICIBANK
    steps: 8,
    basePricePaise: 120000,
    eventGenerators: [corporateEvent(4, "DIVIDEND", "EX_DATE")],
    intentConfigs: [dividendIntent("icici-div", "GENERAL")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 100, 5: 85, 6: 70, 7: 50 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT" },
      relevantSteps: [4, 5, 6, 7],
      rationale: "ICICI dividend event with GENERAL focus — any stage matches.",
    },
  });

  // ── CATEGORY: COMPANY_EVENT (4 scenarios) ──────────────────────────────

  scenarios.push({
    key: "COMPANY_BOARD_CHANGE",
    category: "COMPANY_EVENT",
    instrument: INSTRUMENTS[6], // RELIANCE
    steps: 8,
    basePricePaise: 280000,
    eventGenerators: [corporateEvent(4, "BOARD_CHANGE")],
    intentConfigs: [companyEventIntent("rel-board", "BOARD_CHANGE")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 100, 5: 85, 6: 70, 7: 55 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "SIGNIFICANT" },
      relevantSteps: [4, 5, 6, 7],
      rationale: "Board change event at Reliance matching company event intent.",
    },
  });

  scenarios.push({
    key: "COMPANY_ACQUISITION",
    category: "COMPANY_EVENT",
    instrument: INSTRUMENTS[1], // INFY
    steps: 10,
    basePricePaise: 160000,
    eventGenerators: [corporateEvent(5, "ACQUISITION")],
    intentConfigs: [companyEventIntent("infy-acq", "ACQUISITION")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 5: 100, 6: 90, 7: 80, 8: 65, 9: 50 },
      stepLane: { 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT", 8: "RELEVANT", 9: "RELEVANT" },
      relevantSteps: [5, 6, 7, 8, 9],
      rationale: "Infosys acquisition event matching company event watch.",
    },
  });

  scenarios.push({
    key: "COMPANY_UNMATCHED_KIND",
    category: "COMPANY_EVENT",
    instrument: INSTRUMENTS[0],
    steps: 8,
    basePricePaise: 350000,
    eventGenerators: [corporateEvent(4, "MERGER")],
    intentConfigs: [companyEventIntent("tcs-board", "BOARD_CHANGE")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 25, 5: 20, 6: 15, 7: 10 },
      stepLane: { 4: "QUIET", 5: "QUIET", 6: "QUIET", 7: "QUIET" },
      relevantSteps: [],
      rationale: "Merger event at TCS but intent watches BOARD_CHANGE — event kind mismatch.",
    },
  });

  scenarios.push({
    key: "COMPANY_MULTIPLE_EVENTS",
    category: "COMPANY_EVENT",
    instrument: INSTRUMENTS[8], // WIPRO
    steps: 10,
    basePricePaise: 450000,
    eventGenerators: [
      corporateEvent(4, "BOARD_CHANGE"),
      corporateEvent(6, "ACQUISITION"),
    ],
    intentConfigs: [companyEventIntent("wipro-events", "BOARD_CHANGE")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 100, 5: 90, 6: 100, 7: 85, 8: 70, 9: 55 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT", 8: "RELEVANT", 9: "SIGNIFICANT" },
      relevantSteps: [4, 5, 6, 7, 8],
      rationale: "Board change matches intent at step 4, then acquisition at step 6 adds novelty.",
    },
  });

  // ── CATEGORY: MULTI_SIGNAL (4 scenarios) ───────────────────────────────

  scenarios.push({
    key: "MULTI_EARNINGS_PLUS_PRICE",
    category: "MULTI_SIGNAL",
    instrument: INSTRUMENTS[0], // TCS
    steps: 10,
    basePricePaise: 350000,
    eventGenerators: [earningsEvent(5, "NSE:TCS", ["MARGINS"], "Q2")],
    intentConfigs: [
      earningsIntent("tcs-m2", ["MARGINS"], "Q2"),
      priceIntent("tcs-above", 355000, "ABOVE"),
    ],
    graphConfig: GRAPH_IT_MARGIN,
    goldConfig: {
      stepRelevance: { 5: 100, 6: 100, 7: 95, 8: 85, 9: 70 },
      stepLane: { 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT", 8: "RELEVANT", 9: "RELEVANT" },
      relevantSteps: [5, 6, 7, 8, 9],
      rationale: "Earnings event + price crossing above target — both intents fire, graph connected.",
    },
  });

  scenarios.push({
    key: "MULTI_DRIVER_PLUS_TECH",
    category: "MULTI_SIGNAL",
    instrument: INSTRUMENTS[5], // TATAMOTORS
    steps: 10,
    basePricePaise: 95000,
    eventGenerators: [
      externalDriverEvent(4, "CRUDE", "MATERIAL"),
      technicalEvent(6, "BREAKOUT", 100000),
    ],
    intentConfigs: [
      driverIntent("tata-driver", "CRUDE"),
      technicalIntent("tata-tech", "BREAKOUT"),
    ],
    graphConfig: GRAPH_AUTO_BREAKOUT,
    goldConfig: {
      stepRelevance: { 4: 90, 5: 85, 6: 100, 7: 90, 8: 75, 9: 60 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT", 8: "RELEVANT", 9: "RELEVANT" },
      relevantSteps: [4, 5, 6, 7, 8, 9],
      rationale: "Crude driver event + Tata breakout — two different signal types sustaining relevance.",
    },
  });

  scenarios.push({
    key: "MULTI_QUIET_AFTER_SPIKE",
    category: "MULTI_SIGNAL",
    instrument: INSTRUMENTS[6], // RELIANCE
    steps: 12,
    basePricePaise: 280000,
    eventGenerators: [newsEvent(3, "Reliance announces new joint venture")],
    intentConfigs: [],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 3: 40, 4: 30, 5: 20, 6: 10, 7: 5, 8: 0, 9: 0, 10: 0, 11: 0 },
      stepLane: { 3: "QUIET", 4: "QUIET", 5: "QUIET", 6: "QUIET", 7: "QUIET", 8: "QUIET", 9: "QUIET", 10: "QUIET", 11: "QUIET" },
      relevantSteps: [],
      rationale: "News event with no matching intent — quickly decays below significance threshold.",
    },
  });

  scenarios.push({
    key: "MULTI_VOL_SPIKE_EVENTS",
    category: "MULTI_SIGNAL",
    instrument: INSTRUMENTS[7], // SBIN
    steps: 10,
    basePricePaise: 80000,
    eventGenerators: [
      corporateEvent(4, "DIVIDEND", "EX_DATE"),
      newsEvent(6, "SBI announces digital banking expansion"),
    ],
    intentConfigs: [dividendIntent("sbin-div", "EX_DATE")],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 4: 100, 5: 90, 6: 85, 7: 70, 8: 55, 9: 40 },
      stepLane: { 4: "RELEVANT", 5: "RELEVANT", 6: "RELEVANT", 7: "RELEVANT", 8: "SIGNIFICANT", 9: "QUIET" },
      relevantSteps: [4, 5, 6, 7, 8],
      rationale: "Dividend match sustains relevance; news adds novelty at step 6.",
    },
  });

  // ── CATEGORY: QUIET (2 scenarios) ──────────────────────────────────────

  scenarios.push({
    key: "QUIET_NO_EVENTS",
    category: "QUIET",
    instrument: INSTRUMENTS[2], // HDFCBANK
    steps: 8,
    basePricePaise: 170000,
    eventGenerators: [],
    intentConfigs: [],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      stepLane: { 0: "QUIET", 1: "QUIET", 2: "QUIET", 3: "QUIET", 4: "QUIET", 5: "QUIET", 6: "QUIET", 7: "QUIET" },
      relevantSteps: [],
      rationale: "No events, no intents, flat price — nothing should surface.",
    },
  });

  scenarios.push({
    key: "QUIET_LOW_VOL_DRIFT",
    category: "QUIET",
    instrument: INSTRUMENTS[9], // ITC
    steps: 10,
    basePricePaise: 46000,
    eventGenerators: [],
    intentConfigs: [],
    graphConfig: null,
    goldConfig: {
      stepRelevance: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      stepLane: { 0: "QUIET", 1: "QUIET", 2: "QUIET", 3: "QUIET", 4: "QUIET", 5: "QUIET", 6: "QUIET", 7: "QUIET", 8: "QUIET", 9: "QUIET" },
      relevantSteps: [],
      rationale: "Low-volume price drift with no events or intents — nothing should surface.",
    },
  });

  return scenarios;
}

export const SCENARIOS: ScenarioDefinition[] = defineScenarios();

export function getScenariosByCategory(category: ScenarioDefinition["category"]): ScenarioDefinition[] {
  return SCENARIOS.filter((s) => s.category === category);
}

export function getScenarioByKey(key: string): ScenarioDefinition | undefined {
  return SCENARIOS.find((s) => s.key === key);
}
