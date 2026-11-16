"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  GitBranch,
  CheckCircle2,
} from "lucide-react";

// ── Domain imports (actual V3 engine — pure functions, no Node.js deps) ────
import { analyzeInstrument } from "@/domain/attention/analyze-instrument";
import type { AttentionItem, AttentionLane } from "@/domain/attention/types";
import type {
  MarketEventRecord,
  MarketSnapshotRecord,
  KnowledgeCursorRecord,
} from "@/domain/market/types";
import type { WatchIntentRecord } from "@/domain/intent/types";
import type { WatchGraphRecord } from "@/domain/graph/types";
import type { GraphNodeType } from "@/domain/graph/types";

// ── Scenario definitions (pure data, no Node.js deps) ─────────────────────
import { SCENARIOS, getScenarioByKey } from "@/research/benchmark/scenarios";

// ── Types ──────────────────────────────────────────────────────────────────
import type { AggregateMetrics } from "@/research/types";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SimStep {
  stepIndex: number;
  sequence: number;
  time: Date;
  snapshot: MarketSnapshotRecord;
  events: MarketEventRecord[];
  isAcknowledged: boolean;
  deltaResult: AttentionItem | null;
}

interface SimState {
  scenarioKey: string;
  episodeIndex: number;
  currentStep: number;
  steps: SimStep[];
  isRunning: boolean;
  speed: number;
  cursorSeq: number;
  activeIntentTypes: Set<string>;
}

type SimAction =
  | { type: "SET_SCENARIO"; scenarioKey: string }
  | { type: "SET_EPISODE"; episodeIndex: number }
  | { type: "ADVANCE" }
  | { type: "STEP" }
  | { type: "RESET" }
  | { type: "TOGGLE_PLAY" }
  | { type: "SET_SPEED"; speed: number }
  | { type: "ACKNOWLEDGE"; stepIndex: number }
  | { type: "TOGGLE_INTENT"; intentType: string };

interface ResearchResult {
  id: string;
  name: string;
  metrics: AggregateMetrics;
  description?: string;
}

interface ResearchResponse {
  scenarios: Array<{
    key: string;
    category: string;
    instrument: { id: string; symbol: string; name: string };
    steps: number;
  }>;
  deltaMetrics: AggregateMetrics | null;
  baselines: ResearchResult[];
  ablations: ResearchResult[];
  laneDistribution: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const INTENT_TYPES = [
  "EARNINGS",
  "PRICE_LEVEL",
  "TECHNICAL",
  "DRIVER",
  "DIVIDEND",
  "COMPANY_EVENT",
] as const;

const INTENT_LABELS: Record<string, string> = {
  EARNINGS: "Earnings",
  PRICE_LEVEL: "Price Level",
  TECHNICAL: "Technical",
  DRIVER: "Driver",
  DIVIDEND: "Dividend",
  COMPANY_EVENT: "Company Event",
};

const SCENARIO_CATEGORIES = [
  "EARNINGS",
  "PRICE_LEVEL",
  "TECHNICAL",
  "DRIVER",
  "DIVIDEND",
  "COMPANY_EVENT",
  "MULTI_SIGNAL",
  "QUIET",
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// DETERMINISTIC SCENARIO-TO-EPISODE GENERATOR (client-safe)
// ═══════════════════════════════════════════════════════════════════════════════

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

function generateEpisodeForScenario(scenarioKey: string, episodeIdx: number) {
  const scenario = getScenarioByKey(scenarioKey);
  if (!scenario) return null;

  const seed = episodeIdx * 1000 + SCENARIOS.findIndex((s) => s.key === scenarioKey) * 13 + 42;
  const rng = mulberry32(seed);

  const instrument = scenario.instrument;
  const sortedSnapshots: MarketSnapshotRecord[] = [];
  const events: MarketEventRecord[] = [];
  const now = new Date("2025-08-14T04:30:00.000Z");

  // Cursor position: random 0-30% of steps
  const cursorStep = Math.floor(rng() * (scenario.steps * 0.3 + 1));
  const cursorSeq = cursorStep;

  // Build snapshots
  for (let step = 0; step <= scenario.steps - 1; step++) {
    const seq = step;
    const priceDrift = (rng() - 0.5) * scenario.basePricePaise * 0.003;
    const price = Math.round(scenario.basePricePaise + priceDrift * step);
    const vol = BigInt(Math.round(500000 + rng() * 1000000));
    const expVol = BigInt(Math.round(500000 + rng() * 500000));

    sortedSnapshots.push({
      id: `snap:${scenarioKey}:${episodeIdx}:${step}`,
      instrumentId: instrument.id,
      sequence: seq,
      eventTime: new Date(now.getTime() + step * 1800000),
      pricePaise: price,
      openPaise: price - 100,
      highPaise: price + 200,
      lowPaise: price - 200,
      cumulativeVolume: vol,
      expectedCumulativeVolume: expVol,
      expectedStepMoveBps: Math.round(30 + rng() * 40),
      source: "SIMULATED",
      quality: "FRESH",
    });
  }

  // Generate events from scenario config
  for (const eg of scenario.eventGenerators) {
    const seq = eg.step;
    if (seq >= sortedSnapshots.length) continue;
    events.push({
      id: randomId(rng, `ev:${seq}:`),
      sequence: seq,
      instrumentId: eg.subjectType === "INSTRUMENT" ? instrument.id : eg.subjectType === "EXTERNAL_DRIVER" ? null : instrument.id,
      type: eg.type,
      eventTime: sortedSnapshots[seq]?.eventTime ?? now,
      receivedTime: sortedSnapshots[seq]?.eventTime ?? now,
      source: "SIMULATED",
      quality: eg.quality,
      payload: eg.payload(seed),
      subjectType: eg.subjectType,
      subjectKey: eg.subjectKey,
      tags: eg.tags,
      correctionOfId: null,
    });
  }

  // Build intents
  const intents: WatchIntentRecord[] = scenario.intentConfigs.map((ic) => ({
    id: randomId(rng, `intent:`),
    logicalIntentId: ic.logicalIntentId,
    userId: "demo-user",
    instrumentId: instrument.id,
    type: ic.type,
    originalText: ic.originalText,
    structuredPayload: ic.structuredPayload,
    provenanceSource: "MANUAL",
    provenanceReference: null,
    status: "ACTIVE" as const,
    version: ic.version,
    effectiveFromSequence: ic.effectiveFromSequence,
    resolvedAt: null,
    resolvedAtSequence: null,
    lifecycleReviewedThroughSequence: null,
    supersedesId: null,
    horizon: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  }));

  // Build graphs
  const graphs: WatchGraphRecord[] = [];
  if (scenario.graphConfig) {
    const graphId = randomId(rng, `graph:`);
    const nodes = scenario.graphConfig.nodes.map((n, i) => ({
      id: `${graphId}:node:${i}`,
      graphId,
      nodeKey: n.nodeKey,
      type: n.type,
      label: n.label,
      metadata: {},
      createdAt: now,
    }));
    const nodeIds = new Map(nodes.map((n) => [n.nodeKey, n.id]));
    const edges = scenario.graphConfig.edges.map((e, i) => ({
      id: `${graphId}:edge:${i}`,
      graphId,
      fromNodeId: nodeIds.get(e.fromKey) ?? "",
      toNodeId: nodeIds.get(e.toKey) ?? "",
      relationship: e.relationship,
      weight: e.weight,
      createdAt: now,
    }));
    graphs.push({
      id: graphId,
      logicalGraphId: `lg:${graphId}`,
      userId: "demo-user",
      instrumentId: instrument.id,
      watchIntentLogicalId: scenario.intentConfigs[0]?.logicalIntentId ?? "",
      version: 1,
      status: "ACTIVE",
      provenance: "IMPORTED_DEMO",
      templateKey: null,
      effectiveFromSequence: 0,
      supersedesId: null,
      createdAt: now,
      updatedAt: now,
      nodes,
      edges,
    });
  }

  const cursor: KnowledgeCursorRecord = {
    id: `cursor:${scenarioKey}:${episodeIdx}`,
    userId: "demo-user",
    instrumentId: instrument.id,
    lastSeenSequence: cursorSeq,
    lastSeenEventTime: sortedSnapshots[cursorSeq]?.eventTime ?? now,
    lastObservedSnapshotId: sortedSnapshots[cursorSeq]?.id ?? null,
    cursorVersion: 1,
    createdAt: now,
    updatedAt: now,
  };

  return { instrument, snapshots: sortedSnapshots, events, intents, graphs, cursor, scenario, scenarioKey };
}

function buildSimSteps(
  ep: NonNullable<ReturnType<typeof generateEpisodeForScenario>>,
  activeIntentTypes: Set<string>,
): SimStep[] {
  const sortedSnapshots = [...ep.snapshots].sort((a, b) => a.sequence - b.sequence);
  const startSeq = ep.cursor.lastSeenSequence;
  const steps: SimStep[] = [];

  for (const snap of sortedSnapshots) {
    if (snap.sequence <= startSeq) continue;

    const eventsUpToStep = ep.events.filter(
      (e) => e.sequence > startSeq && e.sequence <= snap.sequence,
    );

    const filteredIntents = ep.intents.filter((intent) =>
      activeIntentTypes.has(intent.type),
    );

    const miniInput = {
      instrument: ep.instrument,
      cursor: ep.cursor,
      currentSequence: snap.sequence,
      currentTime: snap.eventTime,
      snapshots: sortedSnapshots.filter((s) => s.sequence <= snap.sequence),
      events: ep.events.filter((e) => e.sequence <= snap.sequence),
      activeIntents: filteredIntents,
      activeGraphs: ep.graphs,
    };

    const deltaResult = analyzeInstrument(miniInput);

    steps.push({
      stepIndex: steps.length,
      sequence: snap.sequence,
      time: snap.eventTime,
      snapshot: snap,
      events: eventsUpToStep,
      isAcknowledged: false,
      deltaResult,
    });
  }
  return steps;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATION REDUCER
// ═══════════════════════════════════════════════════════════════════════════════

function initSimState(scenarioKey: string, episodeIndex: number): SimState {
  const ep = generateEpisodeForScenario(scenarioKey, episodeIndex);
  const activeIntentTypes = new Set<string>(INTENT_TYPES);
  const steps = ep ? buildSimSteps(ep, activeIntentTypes) : [];
  return {
    scenarioKey,
    episodeIndex,
    currentStep: 0,
    steps,
    isRunning: false,
    speed: 1,
    cursorSeq: ep?.cursor.lastSeenSequence ?? 0,
    activeIntentTypes,
  };
}

function simReducer(state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case "SET_SCENARIO":
      return initSimState(action.scenarioKey, 0);
    case "SET_EPISODE":
      return initSimState(state.scenarioKey, action.episodeIndex);
    case "ADVANCE":
    case "STEP": {
      const nextStep = state.currentStep + 1;
      if (nextStep >= state.steps.length) return { ...state, isRunning: false };
      return {
        ...state,
        currentStep: nextStep,
        isRunning: action.type === "ADVANCE" ? state.isRunning : false,
      };
    }
    case "RESET":
      return initSimState(state.scenarioKey, state.episodeIndex);
    case "TOGGLE_PLAY":
      return { ...state, isRunning: !state.isRunning };
    case "SET_SPEED":
      return { ...state, speed: action.speed };
    case "ACKNOWLEDGE": {
      const ep = generateEpisodeForScenario(state.scenarioKey, state.episodeIndex);
      if (!ep) return state;
      const newSteps = [...state.steps];
      for (let i = 0; i <= action.stepIndex && i < newSteps.length; i++) {
        newSteps[i] = { ...newSteps[i], isAcknowledged: true };
      }
      const lastAckSeq = newSteps[action.stepIndex]?.sequence ?? state.cursorSeq;
      const sortedSnapshots = [...ep.snapshots].sort((a, b) => a.sequence - b.sequence);
      const updatedCursor: KnowledgeCursorRecord = {
        ...ep.cursor,
        lastSeenSequence: lastAckSeq,
        lastSeenEventTime: newSteps[action.stepIndex]?.time ?? ep.cursor.lastSeenEventTime,
      };
      for (let i = action.stepIndex + 1; i < newSteps.length; i++) {
        const snap = sortedSnapshots.find((s) => s.sequence === newSteps[i].sequence);
        if (!snap) continue;
        const filteredIntents = ep.intents.filter((intent) =>
          state.activeIntentTypes.has(intent.type),
        );
        const miniInput = {
          instrument: ep.instrument,
          cursor: updatedCursor,
          currentSequence: snap.sequence,
          currentTime: snap.eventTime,
          snapshots: sortedSnapshots.filter((s) => s.sequence <= snap.sequence),
          events: ep.events.filter((e) => e.sequence <= snap.sequence),
          activeIntents: filteredIntents,
          activeGraphs: ep.graphs,
        };
        newSteps[i] = { ...newSteps[i], isAcknowledged: false, deltaResult: analyzeInstrument(miniInput) };
      }
      return { ...state, steps: newSteps, cursorSeq: lastAckSeq };
    }
    case "TOGGLE_INTENT": {
      const newTypes = new Set(state.activeIntentTypes);
      if (newTypes.has(action.intentType)) {
        if (newTypes.size > 1) newTypes.delete(action.intentType);
      } else {
        newTypes.add(action.intentType);
      }
      const ep = generateEpisodeForScenario(state.scenarioKey, state.episodeIndex);
      if (!ep) return { ...state, activeIntentTypes: newTypes };
      const steps = buildSimSteps(ep, newTypes);
      return { ...state, activeIntentTypes: newTypes, steps, currentStep: 0 };
    }
    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

function fmtPaise(p: number): string {
  return `₹${(p / 100).toFixed(2)}`;
}
function fmtBps(v: number | null): string {
  return v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
}
function fmtScore(v: number): string {
  return v.toFixed(0);
}
function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}
function laneClass(lane: AttentionLane): string {
  if (lane === "RELEVANT") return "rd-lane-rel";
  if (lane === "SIGNIFICANT") return "rd-lane-sig";
  return "rd-lane-quiet";
}
function eventTypeShort(type: string): string {
  const map: Record<string, string> = {
    RESULTS_PUBLISHED: "EARN",
    EXTERNAL_DRIVER: "DRV",
    TECHNICAL_TRANSITION: "TECH",
    CORPORATE_EVENT: "CORP",
    NEWS_EVENT: "NEWS",
    QUOTE_UPDATE: "QUOTE",
  };
  return map[type] ?? type.slice(0, 4);
}
function eventTypeClass(type: string): string {
  if (type === "RESULTS_PUBLISHED") return "rd-event-type-earnings";
  if (type.includes("DRIVER")) return "rd-event-type-driver";
  if (type === "TECHNICAL_TRANSITION") return "rd-event-type-tech";
  if (type === "CORPORATE_EVENT") return "rd-event-type-corp";
  if (type === "NEWS_EVENT") return "rd-event-type-news";
  return "rd-event-type-price";
}
function reasonColor(code: string): React.CSSProperties {
  if (code.includes("UNUSUAL") || code.includes("MATERIAL"))
    return { background: "#d2992222", color: "#d29922" };
  if (code.includes("RELATED") || code.includes("GRAPH"))
    return { background: "#bc8cff22", color: "#bc8cff" };
  if (code.includes("DATA_"))
    return { background: "#8b949e22", color: "#8b949e" };
  return { background: "#58a6ff22", color: "#58a6ff" };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Panel({
  title,
  badge,
  badgeClass,
  children,
  className = "",
  noPad = false,
  style,
}: {
  title: string;
  badge?: string;
  badgeClass?: string;
  children: React.ReactNode;
  className?: string;
  noPad?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`rd-panel ${className}`} style={style}>
      <div className="rd-panel-header">
        <h3>{title}</h3>
        {badge && <span className={`rd-badge ${badgeClass ?? "rd-badge-live"}`}>{badge}</span>}
      </div>
      <div className={noPad ? "rd-panel-body-np" : "rd-panel-body"}>{children}</div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  weight,
  color,
}: {
  label: string;
  value: number;
  weight?: number;
  color: string;
}) {
  const pct = Math.min(100, value);
  return (
    <div className="rd-score-cmp-row">
      <span className="rd-score-cmp-label">{label}</span>
      <div style={{ flex: 1 }}>
        <div className="rd-bar">
          <div className="rd-bar-fill" style={{ width: `${pct}%`, background: color }} />
          <span className="rd-bar-label">{fmtScore(value)}</span>
        </div>
      </div>
      {weight !== undefined && <span className="rd-score-cmp-weight">{(weight * 100).toFixed(0)}%</span>}
    </div>
  );
}

function ScenarioSelector({
  scenarioKey,
  onSelect,
}: {
  scenarioKey: string;
  onSelect: (key: string) => void;
}) {
  const [catFilter, setCatFilter] = useState<string>("ALL");
  const filtered =
    catFilter === "ALL"
      ? SCENARIOS
      : SCENARIOS.filter((s) => s.category === catFilter);
  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        <button
          className={`rd-btn rd-btn-sm ${catFilter === "ALL" ? "rd-btn-active" : ""}`}
          onClick={() => setCatFilter("ALL")}
        >
          All ({SCENARIOS.length})
        </button>
        {SCENARIO_CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`rd-btn rd-btn-sm ${catFilter === cat ? "rd-btn-active" : ""}`}
            onClick={() => setCatFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div style={{ maxHeight: 160, overflowY: "auto" }}>
        {filtered.map((s) => (
          <button
            key={s.key}
            className={`rd-btn rd-btn-sm ${scenarioKey === s.key ? "rd-btn-primary" : ""}`}
            style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 2 }}
            onClick={() => onSelect(s.key)}
          >
            <span style={{ opacity: 0.6, fontSize: 9, marginRight: 4 }}>{s.category}</span>
            {s.key}
          </button>
        ))}
      </div>
    </div>
  );
}

function SimControls({
  state,
  dispatch,
  episodeCount,
}: {
  state: SimState;
  dispatch: React.Dispatch<SimAction>;
  episodeCount: number;
}) {
  return (
    <div className="rd-ctrl-row">
      <button
        className="rd-btn rd-btn-primary"
        onClick={() => dispatch({ type: "TOGGLE_PLAY" })}
        disabled={state.currentStep >= state.steps.length - 1 && !state.isRunning}
      >
        {state.isRunning ? <Pause size={13} /> : <Play size={13} />}
        {state.isRunning ? "Pause" : "Play"}
      </button>
      <button
        className="rd-btn"
        onClick={() => dispatch({ type: "STEP" })}
        disabled={state.currentStep >= state.steps.length - 1}
      >
        <StepForward size={13} /> Step
      </button>
      <button className="rd-btn" onClick={() => dispatch({ type: "RESET" })}>
        <RotateCcw size={13} /> Reset
      </button>
      <div className="rd-speed-sel">
        {[1, 2, 4, 8].map((s) => (
          <button
            key={s}
            className={`rd-speed-btn ${state.speed === s ? "rd-speed-btn-active" : ""}`}
            onClick={() => dispatch({ type: "SET_SPEED", speed: s })}
          >
            {s}×
          </button>
        ))}
      </div>
      <span style={{ color: "#8b949e", fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
        Step {state.currentStep + 1}/{state.steps.length}
      </span>
      {episodeCount > 1 && (
        <select
          className="rd-btn"
          value={state.episodeIndex}
          onChange={(e) => dispatch({ type: "SET_EPISODE", episodeIndex: Number(e.target.value) })}
          style={{ marginLeft: "auto" }}
        >
          {Array.from({ length: episodeCount }, (_, i) => (
            <option key={i} value={i}>Episode {i + 1}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function EventStream({ steps, currentStep }: { steps: SimStep[]; currentStep: number }) {
  const visibleSteps = steps.slice(0, currentStep + 1);
  return (
    <div className="rd-table-scroll" style={{ maxHeight: 340 }}>
      {visibleSteps.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "#484f58", fontSize: 12 }}>
          No events yet. Press Play or Step.
        </div>
      )}
      {visibleSteps.map((step) => (
        <div
          key={step.stepIndex}
          className={`rd-event-row ${step.isAcknowledged ? "rd-event-ack" : "rd-event-new"}`}
        >
          <span className="rd-event-step">S{step.stepIndex}</span>
          <span style={{ color: "#8b949e", minWidth: 56, fontSize: 11 }}>{fmtTime(step.time)}</span>
          <span style={{ minWidth: 36, fontSize: 10, fontWeight: 700 }}>SEQ {step.sequence}</span>
          <span style={{ fontWeight: 600, minWidth: 72 }}>{fmtPaise(step.snapshot.pricePaise)}</span>
          {step.events.length > 0 ? (
            <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {step.events.map((ev) => (
                <span key={ev.id} className={`rd-event-type ${eventTypeClass(ev.type)}`} style={{ fontSize: 10, fontWeight: 700 }}>
                  {eventTypeShort(ev.type)}
                </span>
              ))}
            </span>
          ) : (
            <span style={{ color: "#484f58", fontSize: 10 }}>quote</span>
          )}
          {step.deltaResult && (
            <span className={laneClass(step.deltaResult.lane)} style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700 }}>
              {step.deltaResult.lane}
            </span>
          )}
          <span style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, minWidth: 24, textAlign: "right" }}>
            {step.deltaResult ? fmtScore(step.deltaResult.score) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function RankedItemsPanel({ step }: { step: SimStep | null }) {
  if (!step?.deltaResult) {
    return <div style={{ padding: 20, textAlign: "center", color: "#484f58", fontSize: 12 }}>No analysis available.</div>;
  }
  const r = step.deltaResult;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div className="rd-score-big" style={{ color: r.lane === "RELEVANT" ? "#7ee787" : r.lane === "SIGNIFICANT" ? "#d29922" : "#484f58" }}>
          {fmtScore(r.score)}
        </div>
        <div>
          <span className={`rd-gold-badge rd-gold-${r.lane.toLowerCase()}`}>{r.lane}</span>
          <div style={{ fontSize: 10, color: "#8b949e", marginTop: 2 }}>{r.instrument.symbol} · Seq {r.fromSequence}→{r.toSequence}</div>
        </div>
      </div>
      <div className="rd-score-cmp">
        <ScoreBar label="Significance" value={r.significance} weight={0.30} color="#58a6ff" />
        <ScoreBar label="Relevance" value={r.relevance} weight={0.35} color="#7ee787" />
        <ScoreBar label="Novelty" value={r.novelty} weight={0.15} color="#bc8cff" />
        <ScoreBar label="Urgency" value={r.urgency} weight={0.10} color="#f0883e" />
        <ScoreBar label="Confidence" value={r.confidence} weight={0.10} color="#d29922" />
      </div>
      {r.matchedIntents.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 4 }}>Matched Intents</div>
          {r.matchedIntents.map((m, i) => (
            <div key={i} style={{ padding: "6px 8px", background: "#0d1117", borderRadius: 4, marginBottom: 3, fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
              <span style={{ color: m.matchType === "DIRECT" ? "#58a6ff" : "#bc8cff", fontWeight: 700 }}>{m.matchType}</span>
              {" "}<span style={{ color: "#c9d1d9" }}>{m.reasonCode}</span>
              {" "}<span style={{ color: "#484f58" }}>R:{m.relevance} U:{m.urgency}</span>
              {m.graphMatch && <span style={{ color: "#bc8cff", marginLeft: 6 }}>depth:{m.graphMatch.pathDepth} w:{m.graphMatch.relevance}</span>}
            </div>
          ))}
        </div>
      )}
      <div>
        <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 4 }}>Reason Codes</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {r.reasonCodes.map((rc) => (
            <span key={rc} className="rd-reason-chip" style={reasonColor(rc)}>{rc}</span>
          ))}
          {r.reasonCodes.length === 0 && <span style={{ color: "#484f58", fontSize: 11 }}>None</span>}
        </div>
      </div>
    </div>
  );
}

function IntentSelector({
  activeTypes,
  onToggle,
  intents,
}: {
  activeTypes: Set<string>;
  onToggle: (type: string) => void;
  intents: WatchIntentRecord[];
}) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 6 }}>Active Intent Types</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        {INTENT_TYPES.map((t) => (
          <button key={t} className={`rd-intent-chip ${activeTypes.has(t) ? "rd-intent-chip-active" : ""}`} onClick={() => onToggle(t)}>
            {INTENT_LABELS[t]}
          </button>
        ))}
      </div>
      {intents.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 4 }}>Active Intents ({intents.length})</div>
          {intents.map((intent) => (
            <div key={intent.logicalIntentId} style={{ padding: "5px 8px", background: "#0d1117", borderRadius: 4, marginBottom: 3, fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
              <span style={{ color: "#58a6ff", fontWeight: 600 }}>{intent.type}</span>
              {" "}<span style={{ color: "#8b949e" }}>v{intent.version} · eff:{intent.effectiveFromSequence}</span>
              <div style={{ color: "#c9d1d9", fontSize: 10, marginTop: 2 }}>{intent.originalText ?? "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KnowledgeCursorPanel({
  step,
  cursorSeq,
  onAcknowledge,
  steps,
}: {
  step: SimStep | null;
  cursorSeq: number;
  onAcknowledge: (stepIndex: number) => void;
  steps: SimStep[];
}) {
  const newCount = steps.slice(0, (step?.stepIndex ?? -1) + 1).filter((s) => !s.isAcknowledged).length;
  const ackCount = steps.slice(0, (step?.stepIndex ?? -1) + 1).filter((s) => s.isAcknowledged).length;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <dl className="rd-kv"><dt>Cursor Sequence</dt><dd>{cursorSeq}</dd></dl>
      <dl className="rd-kv"><dt>Current Sequence</dt><dd>{step?.sequence ?? "—"}</dd></dl>
      <div style={{ display: "flex", gap: 12 }}>
        <div><div style={{ fontSize: 9, color: "#7ee787", fontWeight: 700 }}>NEW</div><div style={{ fontSize: 18, fontWeight: 800, fontFamily: "ui-monospace, monospace" }}>{newCount}</div></div>
        <div><div style={{ fontSize: 9, color: "#8b949e", fontWeight: 700 }}>ACK</div><div style={{ fontSize: 18, fontWeight: 800, fontFamily: "ui-monospace, monospace", color: "#8b949e" }}>{ackCount}</div></div>
      </div>
      {step && !step.isAcknowledged && (
        <button className="rd-btn rd-btn-primary" onClick={() => onAcknowledge(step.stepIndex)} style={{ width: "100%" }}>
          <CheckCircle2 size={13} /> Acknowledge Through Step {step.stepIndex}
        </button>
      )}
      <div style={{ fontSize: 10, color: "#484f58", lineHeight: 1.5 }}>
        Acknowledging updates the cursor. Previously seen events are suppressed; new events surface with fresh scores.
      </div>
    </div>
  );
}

function DriverGraphPanel({ step, scenarioKey, selectedNode, onSelectNode }: { step: SimStep | null; scenarioKey: string; selectedNode: string | null; onSelectNode: (key: string | null) => void }) {
  if (!step?.deltaResult) {
    return <div style={{ padding: 20, textAlign: "center", color: "#484f58", fontSize: 12 }}>No graph data.</div>;
  }
  const scenario = getScenarioByKey(scenarioKey);
  if (!scenario?.graphConfig) {
    return (
      <div style={{ padding: 16, textAlign: "center", color: "#484f58", fontSize: 12 }}>
        <GitBranch size={20} style={{ marginBottom: 6, opacity: 0.4 }} />
        <div>No Driver Graph for this scenario.</div>
      </div>
    );
  }
  const matchedKeys = new Set<string>();
  for (const match of step.deltaResult.matchedIntents) {
    if (match.graphMatch) {
      matchedKeys.add(match.graphMatch.eventSubjectKey);
      matchedKeys.add(match.graphMatch.matchedNodeKey);
    }
  }
  // Find connected nodes/edges for the selected node
  const connectedEdges = new Set<string>();
  const connectedNodes = new Set<string>();
  if (selectedNode) {
    connectedNodes.add(selectedNode);
    for (const e of scenario.graphConfig.edges) {
      if (e.fromKey === selectedNode || e.toKey === selectedNode) {
        connectedEdges.add(`${e.fromKey}:${e.toKey}`);
        connectedNodes.add(e.fromKey);
        connectedNodes.add(e.toKey);
      }
    }
  }
  // Find relevance path nodes for highlighting
  const pathNodeKeys = new Set<string>();
  for (const path of step.deltaResult.relevancePaths) {
    for (const node of path) {
      // Match path node labels to graph node keys
      const graphNode = scenario.graphConfig.nodes.find((gn) => gn.label === node.label);
      if (graphNode) pathNodeKeys.add(graphNode.nodeKey);
    }
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 2 }}>Nodes — Click to inspect</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {scenario.graphConfig.nodes.map((n) => {
          const isSelected = selectedNode === n.nodeKey;
          const isConnected = connectedNodes.has(n.nodeKey);
          const isOnPath = pathNodeKeys.has(n.nodeKey);
          const isMatched = matchedKeys.has(n.nodeKey);
          return (
            <button
              key={n.nodeKey}
              onClick={() => onSelectNode(isSelected ? null : n.nodeKey)}
              style={{
                padding: "6px 10px",
                border: `1px solid ${isSelected ? "#58a6ff" : isOnPath ? "#bc8cff55" : "#21262d"}`,
                borderRadius: 4,
                background: isSelected ? "#58a6ff15" : isMatched ? "#d2992211" : "#0d1117",
                color: isSelected ? "#58a6ff" : isMatched ? "#d29922" : "#c9d1d9",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "ui-monospace, monospace",
                textAlign: "left",
                transition: "all 0.15s",
                opacity: selectedNode && !isConnected && !isSelected ? 0.4 : 1,
              }}
            >
              <span style={{ fontSize: 8, color: "#484f58", display: "block" }}>{n.type}</span>
              {n.label}
              {isMatched && <span style={{ fontSize: 8, color: "#d29922", marginLeft: 4 }}>●</span>}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginTop: 4, marginBottom: 2 }}>Edges</div>
      <div style={{ display: "grid", gap: 2 }}>
        {scenario.graphConfig.edges.map((e, i) => {
          const edgeKey = `${e.fromKey}:${e.toKey}`;
          const isHighlighted = connectedEdges.has(edgeKey);
          return (
            <div key={i} className="rd-graph-edge" style={{ opacity: selectedNode && !isHighlighted ? 0.3 : 1, transition: "opacity 0.15s" }}>
              {e.fromKey} →<span style={{ color: isHighlighted ? "#58a6ff" : "#484f58" }}>{e.relationship}</span>→ {e.toKey} <span style={{ color: "#58a6ff" }}>{e.weight}%</span>
            </div>
          );
        })}
      </div>
      {/* Selected node detail */}
      {selectedNode && (() => {
        const node = scenario.graphConfig.nodes.find((n) => n.nodeKey === selectedNode);
        const outgoing = scenario.graphConfig.edges.filter((e) => e.fromKey === selectedNode);
        const incoming = scenario.graphConfig.edges.filter((e) => e.toKey === selectedNode);
        return (
          <div style={{ padding: "8px 10px", background: "#58a6ff08", border: "1px solid #58a6ff22", borderRadius: 4, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#58a6ff" }}>{node?.label ?? selectedNode}</span>
                <span style={{ fontSize: 10, color: "#8b949e", marginLeft: 6 }}>{node?.type}</span>
              </div>
              <button onClick={() => onSelectNode(null)} style={{ background: "none", border: 0, color: "#8b949e", cursor: "pointer", fontSize: 11 }}>✕</button>
            </div>
            {outgoing.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 10 }}>
                <span style={{ color: "#8b949e" }}>Outgoing: </span>
                {outgoing.map((e, i) => (
                  <span key={i} style={{ color: "#c9d1d9" }}>{i > 0 ? ", " : ""}{e.relationship} → {e.toKey} ({e.weight}%)</span>
                ))}
              </div>
            )}
            {incoming.length > 0 && (
              <div style={{ marginTop: 3, fontSize: 10 }}>
                <span style={{ color: "#8b949e" }}>Incoming: </span>
                {incoming.map((e, i) => (
                  <span key={i} style={{ color: "#c9d1d9" }}>{i > 0 ? ", " : ""}{e.fromKey} → {e.relationship} ({e.weight}%)</span>
                ))}
              </div>
            )}
            {matchedKeys.has(selectedNode) && (
              <div style={{ marginTop: 4, fontSize: 10, color: "#d29922", fontWeight: 600 }}>● Matched in current step</div>
            )}
            {pathNodeKeys.has(selectedNode) && (
              <div style={{ marginTop: 2, fontSize: 10, color: "#bc8cff", fontWeight: 600 }}>● On relevance path</div>
            )}
          </div>
        );
      })()}
      {step.deltaResult.relevancePaths.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: "#bc8cff", fontWeight: 700, marginBottom: 3 }}>Relevance Paths</div>
          {step.deltaResult.relevancePaths.map((path, i) => (
            <div key={i} style={{ fontSize: 10, color: "#c9d1d9", marginBottom: 2 }}>{path.map((n) => n.label).join(" → ")}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExplanationPanel({ step }: { step: SimStep | null }) {
  if (!step?.deltaResult) {
    return <div style={{ padding: 16, textAlign: "center", color: "#484f58", fontSize: 12 }}>Select a step to see explanation.</div>;
  }
  const r = step.deltaResult;
  const d = r.display;
  return (
    <div className="rd-explanation">
      <div style={{ marginBottom: 8 }}><span style={{ color: "#8b949e", fontSize: 9, textTransform: "uppercase", letterSpacing: ".06em" }}>{d.label}</span></div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f6fc", marginBottom: 4 }}>{d.headline}</div>
      <div style={{ color: "#8b949e", marginBottom: 8 }}>{d.whySeeing}</div>
      {d.watchReason && (
        <div style={{ padding: "6px 8px", background: "#1f6feb11", borderRadius: 4, borderLeft: "2px solid #58a6ff", marginBottom: 6 }}>
          <span style={{ color: "#58a6ff", fontSize: 10, fontWeight: 700 }}>WATCH REASON: </span>
          <span style={{ fontSize: 11 }}>{d.watchReason}</span>
        </div>
      )}
      {d.connectionPath.length > 0 && (
        <div style={{ padding: "6px 8px", background: "#bc8cff11", borderRadius: 4, borderLeft: "2px solid #bc8cff", marginBottom: 6 }}>
          <span style={{ color: "#bc8cff", fontSize: 10, fontWeight: 700 }}>CONNECTION: </span>
          <span style={{ fontSize: 11, color: "#c9d1d9" }}>{d.connectionPath.join(" → ")}</span>
        </div>
      )}
      {d.additionalSignals.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {d.additionalSignals.map((s, i) => (
            <div key={i} style={{ color: "#58a6ff", fontSize: 11, fontWeight: 600 }}>+ {s}</div>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10, padding: "8px 0", borderTop: "1px solid #21262d" }}>
        <dl className="rd-kv"><dt>Δ Price</dt><dd style={{ color: r.priceDeltaBps >= 0 ? "#7ee787" : "#f85149" }}>{fmtBps(r.priceDeltaBps)} bps</dd></dl>
        <dl className="rd-kv"><dt>Expected</dt><dd>{r.expectedWindowMoveBps !== null ? `${r.expectedWindowMoveBps.toFixed(1)} bps` : "—"}</dd></dl>
        <dl className="rd-kv"><dt>Surprise</dt><dd>{r.priceSurprise !== null ? `${r.priceSurprise.toFixed(2)}σ` : "—"}</dd></dl>
        <dl className="rd-kv"><dt>Volume</dt><dd>{r.volumeRatio !== null ? `${r.volumeRatio.toFixed(2)}×` : "—"}</dd></dl>
        <dl className="rd-kv"><dt>From</dt><dd>{fmtPaise(r.baselinePricePaise)}</dd></dl>
        <dl className="rd-kv"><dt>To</dt><dd>{fmtPaise(r.currentPricePaise)}</dd></dl>
      </div>
    </div>
  );
}

function ResearchResultsTable({ results }: { results: ResearchResponse | null }) {
  if (!results) return <div style={{ padding: 20, textAlign: "center", color: "#8b949e", fontSize: 12 }}>Loading benchmark results…</div>;
  const allRows = [
    ...(results.deltaMetrics ? [{ id: "delta-v3", name: "Delta V3 (Full)", metrics: results.deltaMetrics }] : []),
    ...results.baselines,
  ];
  const metrics = [
    { key: "ndcgAt5" as const, label: "NDCG@5" },
    { key: "precisionAt5" as const, label: "Prec@5" },
    { key: "recallAt5" as const, label: "Rec@5" },
    { key: "mrr" as const, label: "MRR" },
    { key: "macroF1" as const, label: "Macro-F1" },
    { key: "weightedF1" as const, label: "W-F1" },
    { key: "repeatSurfaceRate" as const, label: "RSR" },
    { key: "contextualRecall" as const, label: "Ctx Rec" },
  ];
  return (
    <div className="rd-table-scroll" style={{ maxHeight: 400 }}>
      <table className="rd-table">
        <thead><tr><th>System</th>{metrics.map((m) => <th key={m.key} style={{ textAlign: "right" }}>{m.label}</th>)}</tr></thead>
        <tbody>
          {allRows.map((row) => (
            <tr key={row.id}>
              <td style={{ fontWeight: row.id === "delta-v3" ? 700 : 400, color: row.id === "delta-v3" ? "#7ee787" : "#c9d1d9" }}>{row.name}</td>
              {metrics.map((m) => (
                <td key={m.key} style={{ textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                  {row.metrics[m.key].value.toFixed(3)}
                  {row.metrics[m.key].ci95 && <span style={{ color: "#484f58", fontSize: 9 }}> [{row.metrics[m.key].ci95![0].toFixed(3)}, {row.metrics[m.key].ci95![1].toFixed(3)}]</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AblationChart({ results }: { results: ResearchResponse | null }) {
  if (!results?.deltaMetrics) return null;
  const deltaNDCG = results.deltaMetrics.ndcgAt5.value;
  const rows = [
    { id: "full", name: "Full Delta", ndcg: deltaNDCG },
    ...results.ablations.map((a) => ({
      id: a.id,
      name: a.name,
      ndcg: a.metrics.ndcgAt5.value,
    })),
  ];
  const maxNDCG = Math.max(...rows.map((r) => r.ndcg), 0.01);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {rows.map((row) => {
        const pct = (row.ndcg / maxNDCG) * 100;
        const delta = row.ndcg - deltaNDCG;
        return (
          <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 100, fontSize: 11, color: "#c9d1d9", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{row.name}</span>
            <div style={{ flex: 1 }}>
              <div className="rd-bar" style={{ height: 20 }}>
                <div className="rd-bar-fill" style={{ width: `${pct}%`, background: row.id === "full" ? "#238636" : delta >= 0 ? "#58a6ff" : "#f85149" }} />
                <span className="rd-bar-label">{row.ndcg.toFixed(3)}</span>
              </div>
            </div>
            {row.id !== "full" && (
              <span style={{ width: 52, fontSize: 10, fontFamily: "ui-monospace, monospace", fontWeight: 700, color: delta >= 0 ? "#7ee787" : "#f85149", textAlign: "right" }}>
                {delta >= 0 ? "+" : ""}{delta.toFixed(3)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LaneDistribution({ dist }: { dist: Record<string, number> | undefined }) {
  if (!dist) return null;
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  return (
    <div style={{ display: "flex", gap: 2, height: 8, borderRadius: 4, overflow: "hidden" }}>
      {(["RELEVANT", "SIGNIFICANT", "QUIET"] as const).map((lane) => {
        const count = dist[lane] ?? 0;
        const pct = (count / total) * 100;
        const color = lane === "RELEVANT" ? "#238636" : lane === "SIGNIFICANT" ? "#d29922" : "#484f58";
        return pct > 0 ? <div key={lane} style={{ width: `${pct}%`, background: color }} title={`${lane}: ${count} (${pct.toFixed(1)}%)`} /> : null;
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ResearchDashboardPage() {
  const [scenarioKey, setScenarioKey] = useState(SCENARIOS[0].key);
  const [state, dispatch] = useReducer(
    simReducer,
    { scenarioKey, episodeIndex: 0 },
    (init) => initSimState(init.scenarioKey, init.episodeIndex),
  );
  const [researchResults, setResearchResults] = useState<ResearchResponse | null>(null);
  const [selectedGraphNode, setSelectedGraphNode] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state.isRunning) {
      timerRef.current = setTimeout(() => dispatch({ type: "ADVANCE" }), 1200 / state.speed);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.isRunning, state.currentStep, state.speed, state.steps.length]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/research")
      .then((r) => r.json())
      .then((data: ResearchResponse) => { if (!cancelled) setResearchResults(data); })
      .catch((err) => console.error("Failed to load research results:", err));
    return () => { cancelled = true; };
  }, []);

  const handleScenarioChange = useCallback((key: string) => {
    setScenarioKey(key);
    dispatch({ type: "SET_SCENARIO", scenarioKey: key });
    setSelectedGraphNode(null);
  }, [dispatch]);

  const currentStep = state.steps[state.currentStep] ?? null;
  const scenario = getScenarioByKey(scenarioKey);

  // Memoize episode data to avoid recomputing on every render
  const episodeData = useMemo(() => generateEpisodeForScenario(scenarioKey, state.episodeIndex), [scenarioKey, state.episodeIndex]);

  return (
    <div className="rd-page">
      <div className="rd-shell">
        {/* Header */}
        <div className="rd-header">
          <h1><span style={{ color: "#238636" }}>GROWw</span> <span style={{ color: "#f0f6fc" }}>DELTA V3</span></h1>
          <p>Intent-Conditioned Financial Event Ranking — Research Demonstrator</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <span className="rd-badge rd-badge-live">LIVE SIMULATION</span>
            <span className="rd-badge rd-badge-bench">EMPIRICAL BENCHMARK</span>
            <span className="rd-badge rd-badge-hist">HISTORICAL DATA</span>
          </div>
        </div>

        {/* Controls + Scenario Selector */}
        <div className="rd-grid rd-grid-2-1" style={{ marginBottom: 12 }}>
          <Panel title="Simulation Controls" badge="LIVE" badgeClass="rd-badge-live">
            <div style={{ display: "grid", gap: 10 }}>
              <SimControls state={state} dispatch={dispatch} episodeCount={3} />
              {scenario && (
                <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#8b949e", fontFamily: "ui-monospace, monospace" }}>
                  <span>Scenario: <strong style={{ color: "#c9d1d9" }}>{scenario.key}</strong></span>
                  <span>·</span>
                  <span>Category: <strong style={{ color: "#c9d1d9" }}>{scenario.category}</strong></span>
                  <span>·</span>
                  <span>Steps: <strong style={{ color: "#c9d1d9" }}>{scenario.steps}</strong></span>
                </div>
              )}
            </div>
          </Panel>
          <Panel title="Scenarios" badge={`${SCENARIOS.length} scenarios`} badgeClass="rd-badge-bench">
            <ScenarioSelector scenarioKey={scenarioKey} onSelect={handleScenarioChange} />
          </Panel>
        </div>

        {/* Main 3-column: Event Stream + Ranking + Explanation */}
        <div className="rd-grid rd-grid-3" style={{ marginBottom: 12 }}>
          <Panel title="Live Event Stream" badge={`${state.steps.slice(0, state.currentStep + 1).length} events`} badgeClass="rd-badge-live">
            <EventStream steps={state.steps} currentStep={state.currentStep} />
          </Panel>
          <Panel title="Delta Attention Ranking" badge="V3 ENGINE" badgeClass="rd-badge-live">
            <RankedItemsPanel step={currentStep} />
          </Panel>
          <Panel title="Explanation Panel">
            <ExplanationPanel step={currentStep} />
          </Panel>
        </div>

        {/* Intent + Cursor + Graph */}
        <div className="rd-grid rd-grid-3" style={{ marginBottom: 12 }}>
          <Panel title="Watch Intent">
            <IntentSelector
              activeTypes={state.activeIntentTypes}
              onToggle={(t) => dispatch({ type: "TOGGLE_INTENT", intentType: t })}
              intents={episodeData?.intents ?? []}
            />
          </Panel>
          <Panel title="Knowledge Cursor">
            <KnowledgeCursorPanel
              step={currentStep}
              cursorSeq={state.cursorSeq}
              onAcknowledge={(stepIndex) => dispatch({ type: "ACKNOWLEDGE", stepIndex })}
              steps={state.steps}
            />
          </Panel>
          <Panel title="Driver Graph" badge="BOUNDED BFS" badgeClass="rd-badge-bench">
            <DriverGraphPanel step={currentStep} scenarioKey={scenarioKey} selectedNode={selectedGraphNode} onSelectNode={setSelectedGraphNode} />
          </Panel>
        </div>

        {/* ── EMPIRICAL RESULTS ─────────────────────────────────────────── */}
        <div style={{ padding: "16px 0 8px", borderTop: "1px solid #21262d", marginTop: 8 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f0f6fc", fontFamily: "ui-monospace, monospace" }}>EMPIRICAL BENCHMARK RESULTS</h2>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8b949e" }}>Evaluation across 300 episodes × 40 scenarios using the actual V3 scoring engine</p>
        </div>

        {/* Baselines + Ablations */}
        <div className="rd-grid rd-grid-2" style={{ marginBottom: 12 }}>
          <Panel title="Baseline Comparison" badge={`${(researchResults?.baselines.length ?? 0) + (researchResults?.deltaMetrics ? 1 : 0)} systems`} badgeClass="rd-badge-bench">
            <ResearchResultsTable results={researchResults} />
          </Panel>
          <Panel title="Ablation Study — NDCG@5" badge="Δ EFFECT" badgeClass="rd-badge-bench">
            <AblationChart results={researchResults} />
            {researchResults && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 4 }}>Gold Lane Distribution</div>
                <LaneDistribution dist={researchResults.laneDistribution} />
                <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 10, color: "#8b949e" }}>
                  {(["RELEVANT", "SIGNIFICANT", "QUIET"] as const).map((lane) => (
                    <span key={lane}><span style={{ color: lane === "RELEVANT" ? "#7ee787" : lane === "SIGNIFICANT" ? "#d29922" : "#484f58" }}>■</span> {lane}: {researchResults.laneDistribution[lane] ?? 0}</span>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Ablation Detail Table */}
        {researchResults && (
          <Panel title="Ablation Details" badge="ALL ABLATIONS" badgeClass="rd-badge-bench" style={{ marginBottom: 12 }}>
            <div className="rd-table-scroll" style={{ maxHeight: 360 }}>
              <table className="rd-table">
                <thead>
                  <tr><th>Variant</th><th style={{ textAlign: "right" }}>NDCG@5</th><th style={{ textAlign: "right" }}>Δ</th><th style={{ textAlign: "right" }}>Prec@5</th><th style={{ textAlign: "right" }}>Rec@5</th><th style={{ textAlign: "right" }}>MRR</th><th style={{ textAlign: "right" }}>Macro-F1</th><th style={{ textAlign: "right" }}>W-F1</th><th>Description</th></tr>
                </thead>
                <tbody>
                  {researchResults.deltaMetrics && (
                    <tr>
                      <td style={{ fontWeight: 700, color: "#7ee787" }}>Delta V3 (Full)</td>
                      <td style={{ textAlign: "right" }}>{researchResults.deltaMetrics.ndcgAt5.value.toFixed(3)}</td>
                      <td style={{ textAlign: "right" }}>—</td>
                      <td style={{ textAlign: "right" }}>{researchResults.deltaMetrics.precisionAt5.value.toFixed(3)}</td>
                      <td style={{ textAlign: "right" }}>{researchResults.deltaMetrics.recallAt5.value.toFixed(3)}</td>
                      <td style={{ textAlign: "right" }}>{researchResults.deltaMetrics.mrr.value.toFixed(3)}</td>
                      <td style={{ textAlign: "right" }}>{researchResults.deltaMetrics.macroF1.value.toFixed(3)}</td>
                      <td style={{ textAlign: "right" }}>{researchResults.deltaMetrics.weightedF1.value.toFixed(3)}</td>
                      <td style={{ color: "#8b949e", fontSize: 10 }}>Full model with all components</td>
                    </tr>
                  )}
                  {researchResults.ablations.map((a) => {
                    const deltaNDCG = researchResults.deltaMetrics?.ndcgAt5.value ?? 0;
                    const ndcgDelta = a.metrics.ndcgAt5.value - deltaNDCG;
                    return (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>{a.name}</td>
                        <td style={{ textAlign: "right" }}>{a.metrics.ndcgAt5.value.toFixed(3)}</td>
                        <td style={{ textAlign: "right", color: ndcgDelta >= 0 ? "#7ee787" : "#f85149", fontWeight: 700 }}>
                          {ndcgDelta >= 0 ? "+" : ""}{ndcgDelta.toFixed(3)}
                        </td>
                        <td style={{ textAlign: "right" }}>{a.metrics.precisionAt5.value.toFixed(3)}</td>
                        <td style={{ textAlign: "right" }}>{a.metrics.recallAt5.value.toFixed(3)}</td>
                        <td style={{ textAlign: "right" }}>{a.metrics.mrr.value.toFixed(3)}</td>
                        <td style={{ textAlign: "right" }}>{a.metrics.macroF1.value.toFixed(3)}</td>
                        <td style={{ textAlign: "right" }}>{a.metrics.weightedF1.value.toFixed(3)}</td>
                        <td style={{ color: "#8b949e", fontSize: 10 }}>{a.description ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {/* Footer */}
        <div style={{ padding: "16px 0", borderTop: "1px solid #21262d", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#484f58", fontFamily: "ui-monospace, monospace" }}>
            Delta V3 Scoring: 0.30×Significance + 0.35×Relevance + 0.15×Novelty + 0.10×Urgency + 0.10×Confidence
          </span>
          <span style={{ fontSize: 10, color: "#484f58", fontFamily: "ui-monospace, monospace" }}>
            Lane: Relevance&gt;0→RELEVANT | Significance≥50→SIGNIFICANT | else→QUIET
          </span>
        </div>
      </div>
    </div>
  );
}
