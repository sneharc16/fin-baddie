import type { WatchGraphDraft } from "./types";

export const MAX_GRAPH_DEPTH = 3;
export const MAX_GRAPH_VISITED_NODES = 25;

export class GraphDomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "GraphDomainError";
  }
}

export function validateGraphDraft(draft: WatchGraphDraft, instrumentId: string): void {
  const roots = draft.nodes.filter((node) => node.type === "INSTRUMENT");
  if (roots.length !== 1) throw new GraphDomainError("GRAPH_ROOT_REQUIRED", "A watch graph must contain exactly one instrument root.");
  if (roots[0].nodeKey !== instrumentId) throw new GraphDomainError("GRAPH_INSTRUMENT_MISMATCH", "The graph root must match its Watch Intent instrument.");
  if (draft.nodes.length > MAX_GRAPH_VISITED_NODES) throw new GraphDomainError("GRAPH_NODE_LIMIT", `A watch graph may contain at most ${MAX_GRAPH_VISITED_NODES} nodes.`);
  const keys = new Set<string>();
  for (const node of draft.nodes) {
    if (keys.has(node.nodeKey)) throw new GraphDomainError("DUPLICATE_GRAPH_NODE", "Node keys must be unique within a graph version.");
    keys.add(node.nodeKey);
  }
  const exactEdges = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const edge of draft.edges) {
    if (!keys.has(edge.fromKey) || !keys.has(edge.toKey)) throw new GraphDomainError("EDGE_NODE_MISMATCH", "Every edge node must belong to the same graph.");
    if (edge.fromKey === edge.toKey) throw new GraphDomainError("GRAPH_SELF_EDGE", "A graph node cannot connect to itself.");
    if (!Number.isInteger(edge.weight) || edge.weight < 0 || edge.weight > 100) throw new GraphDomainError("INVALID_GRAPH_WEIGHT", "Graph relevance weights must be integers from 0 to 100.");
    const exact = `${edge.fromKey}:${edge.toKey}:${edge.relationship}`;
    if (exactEdges.has(exact)) throw new GraphDomainError("DUPLICATE_GRAPH_EDGE", "Duplicate graph connections are not allowed.");
    exactEdges.add(exact);
    adjacency.set(edge.fromKey, [...(adjacency.get(edge.fromKey) ?? []), edge.toKey]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (key: string): void => {
    if (visiting.has(key)) throw new GraphDomainError("GRAPH_CYCLE", "Watch graphs cannot contain recursive cycles.");
    if (visited.has(key)) return;
    visiting.add(key);
    for (const next of adjacency.get(key) ?? []) walk(next);
    visiting.delete(key);
    visited.add(key);
  };
  for (const key of keys) walk(key);

  const reachable = new Set<string>();
  const deepestVisit = new Map<string, number>();
  const walkFromRoot = (key: string, depth: number): void => {
    if (depth > MAX_GRAPH_DEPTH) throw new GraphDomainError("GRAPH_DEPTH_LIMIT", `A watch graph path may contain at most ${MAX_GRAPH_DEPTH} edges.`);
    if ((deepestVisit.get(key) ?? -1) >= depth) return;
    deepestVisit.set(key, depth);
    reachable.add(key);
    for (const next of adjacency.get(key) ?? []) walkFromRoot(next, depth + 1);
  };
  walkFromRoot(roots[0].nodeKey, 0);
  if (reachable.size !== keys.size) throw new GraphDomainError("GRAPH_DISCONNECTED", "Every graph node must be connected to the instrument root.");
}
