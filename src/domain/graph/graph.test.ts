import { describe, expect, it } from "vitest";
import type { MarketEventRecord } from "@/domain/market/types";
import { intentRecord } from "../../../tests/helpers/in-memory";
import type { WatchGraphDraft, WatchGraphRecord } from "./types";
import { matchGraphEvents } from "./traversal";
import { validateGraphDraft } from "./validation";

const baseDraft: WatchGraphDraft = {
  nodes: [
    { nodeKey: "NSE:INDIGO", type: "INSTRUMENT", label: "IndiGo" },
    { nodeKey: "FUEL_COST", type: "DRIVER", label: "Fuel cost" },
    { nodeKey: "CRUDE", type: "EXTERNAL_DRIVER", label: "Crude" },
  ],
  edges: [
    { fromKey: "NSE:INDIGO", toKey: "FUEL_COST", relationship: "RELATES_TO", weight: 100 },
    { fromKey: "FUEL_COST", toKey: "CRUDE", relationship: "AFFECTED_BY", weight: 85 },
  ],
};

function graph(draft: WatchGraphDraft = baseDraft, overrides: Partial<WatchGraphRecord> = {}): WatchGraphRecord {
  const now = new Date("2025-08-14T04:30:00.000Z");
  const id = overrides.id ?? "graph-v1";
  const nodes = draft.nodes.map((node, index) => ({ id: `${id}-node-${index}`, graphId: id, nodeKey: node.nodeKey, type: node.type, label: node.label, metadata: node.metadata ?? {}, createdAt: now }));
  const ids = new Map(nodes.map((node) => [node.nodeKey, node.id]));
  return {
    id, logicalGraphId: "logical-graph", userId: "demo-user", instrumentId: "NSE:INDIGO", watchIntentLogicalId: "logical-1",
    version: 1, status: "ACTIVE", provenance: "CURATED_TEMPLATE", templateKey: "AIRLINE_FUEL_COST", effectiveFromSequence: 0,
    supersedesId: null, createdAt: now, updatedAt: now, nodes,
    edges: draft.edges.map((edge, index) => ({ id: `${id}-edge-${index}`, graphId: id, fromNodeId: ids.get(edge.fromKey) ?? edge.fromKey, toNodeId: ids.get(edge.toKey) ?? edge.toKey, relationship: edge.relationship, weight: edge.weight, createdAt: now })),
    ...overrides,
  };
}

function event(overrides: Partial<MarketEventRecord> = {}): MarketEventRecord {
  const time = new Date("2025-08-14T06:28:00.000Z");
  return {
    id: "crude-event", sequence: 4, instrumentId: null, type: "EXTERNAL_DRIVER", eventTime: time, receivedTime: time,
    source: "test", quality: "FRESH", payload: { externalMetric: "CRUDE", magnitude: "MATERIAL" },
    subjectType: "EXTERNAL_DRIVER", subjectKey: "CRUDE", tags: ["CRUDE", "FUEL_COST"], correctionOfId: null, ...overrides,
  };
}

function matches(watchGraph = graph(), marketEvent = event(), currentSequence = 4) {
  return matchGraphEvents({ graph: watchGraph, intent: intentRecord({ instrumentId: "NSE:INDIGO", type: "DRIVER", structuredPayload: { driverKey: "FUEL_COST", description: "Fuel" } }), events: [marketEvent], cursorSequence: 2, currentSequence });
}

describe("watch graph validation and traversal", () => {
  it("accepts a valid small graph", () => expect(() => validateGraphDraft(baseDraft, "NSE:INDIGO")).not.toThrow());

  it("requires exactly one matching instrument root", () => {
    expect(() => validateGraphDraft({ ...baseDraft, nodes: baseDraft.nodes.filter((node) => node.type !== "INSTRUMENT") }, "NSE:INDIGO")).toThrowError(expect.objectContaining({ code: "GRAPH_ROOT_REQUIRED" }));
    expect(() => validateGraphDraft(baseDraft, "NSE:TCS")).toThrowError(expect.objectContaining({ code: "GRAPH_INSTRUMENT_MISMATCH" }));
  });

  it("rejects edges whose nodes are outside the graph", () => {
    expect(() => validateGraphDraft({ ...baseDraft, edges: [{ fromKey: "NSE:INDIGO", toKey: "MISSING", relationship: "RELATES_TO", weight: 100 }] }, "NSE:INDIGO")).toThrowError(expect.objectContaining({ code: "EDGE_NODE_MISMATCH" }));
  });

  it("rejects self edges and exact duplicate edges", () => {
    expect(() => validateGraphDraft({ ...baseDraft, edges: [{ fromKey: "FUEL_COST", toKey: "FUEL_COST", relationship: "RELATES_TO", weight: 100 }] }, "NSE:INDIGO")).toThrowError(expect.objectContaining({ code: "GRAPH_SELF_EDGE" }));
    expect(() => validateGraphDraft({ ...baseDraft, edges: [baseDraft.edges[0], baseDraft.edges[0]] }, "NSE:INDIGO")).toThrowError(expect.objectContaining({ code: "DUPLICATE_GRAPH_EDGE" }));
  });

  it("rejects graph paths beyond three edges", () => {
    const draft: WatchGraphDraft = {
      nodes: [baseDraft.nodes[0], ...[1, 2, 3, 4].map((number) => ({ nodeKey: `N${number}`, type: "DRIVER" as const, label: `N${number}` }))],
      edges: [1, 2, 3, 4].map((number) => ({ fromKey: number === 1 ? "NSE:INDIGO" : `N${number - 1}`, toKey: `N${number}`, relationship: "RELATES_TO" as const, weight: 100 })),
    };
    expect(() => validateGraphDraft(draft, "NSE:INDIGO")).toThrowError(expect.objectContaining({ code: "GRAPH_DEPTH_LIMIT" }));
  });

  it("enforces the visited-node limit", () => {
    const childNodes = Array.from({ length: 25 }, (_, index) => ({ nodeKey: `N${index}`, type: "DRIVER" as const, label: `N${index}` }));
    const draft: WatchGraphDraft = { nodes: [baseDraft.nodes[0], ...childNodes], edges: childNodes.map((node) => ({ fromKey: "NSE:INDIGO", toKey: node.nodeKey, relationship: "RELATES_TO", weight: 100 })) };
    expect(() => matches(graph(draft), event({ subjectKey: "N24", tags: ["N24"] }))).toThrowError(expect.objectContaining({ code: "GRAPH_VISITED_NODE_LIMIT" }));
  });

  it("multiplies edge weights into deterministic path relevance", () => {
    const match = matches()[0];
    expect(match.relevance).toBe(85);
    expect(match.path.map((node) => node.key)).toEqual(["NSE:INDIGO", "FUEL_COST", "CRUDE"]);
    expect(match.pathDepth).toBe(2);
  });

  it("selects the strongest of multiple paths to the same subject", () => {
    const draft: WatchGraphDraft = {
      nodes: [...baseDraft.nodes, { nodeKey: "ALT", type: "DRIVER", label: "Alternate" }],
      edges: [
        ...baseDraft.edges,
        { fromKey: "NSE:INDIGO", toKey: "ALT", relationship: "RELATES_TO", weight: 70 },
        { fromKey: "ALT", toKey: "CRUDE", relationship: "CONTEXT_FOR", weight: 80 },
      ],
    };
    const match = matches(graph(draft))[0];
    expect(match.relevance).toBe(85);
    expect(match.path.map((node) => node.key)).toEqual(["NSE:INDIGO", "FUEL_COST", "CRUDE"]);
  });

  it("does not promote paths below the graph relevance threshold", () => {
    const weak = structuredClone(baseDraft);
    weak.edges[1].weight = 49;
    expect(matches(graph(weak))).toEqual([]);
  });

  it.each(["STALE", "CONFLICTING"] as const)("does not promote %s graph events", (quality) => {
    expect(matches(graph(), event({ quality }))).toEqual([]);
  });

  it("allows delayed events with reduced confidence handled by attention analysis", () => {
    expect(matches(graph(), event({ quality: "DELAYED" }))[0]?.relevance).toBe(85);
  });

  it("ignores events older than a newly-created graph version", () => {
    expect(matches(graph(baseDraft, { effectiveFromSequence: 4 }), event({ sequence: 3 }))).toEqual([]);
  });

  it("does not use a removed subject node even when an event tag names its parent", () => {
    const withoutCrude: WatchGraphDraft = { nodes: baseDraft.nodes.filter((node) => node.nodeKey !== "CRUDE"), edges: baseDraft.edges.filter((edge) => edge.toKey !== "CRUDE") };
    expect(matches(graph(withoutCrude))).toEqual([]);
  });
});
