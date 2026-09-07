import type { WatchIntentRecord } from "@/domain/intent/types";
import type { MarketEventRecord } from "@/domain/market/types";
import type { GraphMatch, RelevancePathNode, WatchGraphRecord } from "./types";
import { GraphDomainError, MAX_GRAPH_DEPTH, MAX_GRAPH_VISITED_NODES } from "./validation";

export const MIN_GRAPH_RELEVANCE = 50;
const blockedQualities = new Set(["STALE", "CONFLICTING"]);

function pathsToTargets(graph: WatchGraphRecord, targetKeys: Set<string>): Array<{ path: RelevancePathNode[]; weight: number }> {
  const roots = graph.nodes.filter((node) => node.type === "INSTRUMENT");
  if (roots.length !== 1) throw new GraphDomainError("GRAPH_ROOT_REQUIRED", "A watch graph must contain exactly one instrument root.");
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, typeof graph.edges>();
  for (const edge of graph.edges) {
    const from = nodeById.get(edge.fromNodeId);
    const to = nodeById.get(edge.toNodeId);
    if (!from || !to || from.graphId !== graph.id || to.graphId !== graph.id || edge.graphId !== graph.id) {
      throw new GraphDomainError("EDGE_NODE_MISMATCH", "Every edge node must belong to the same graph.");
    }
    outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge]);
  }
  const visitedNodes = new Set<string>();
  const results: Array<{ path: RelevancePathNode[]; weight: number }> = [];
  const queue = [{ node: roots[0], ids: [roots[0].id], path: [{ type: roots[0].type, key: roots[0].nodeKey, label: roots[0].label }], weight: 1 }];
  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    visitedNodes.add(current.node.id);
    if (visitedNodes.size > MAX_GRAPH_VISITED_NODES) throw new GraphDomainError("GRAPH_VISITED_NODE_LIMIT", `Graph traversal exceeded ${MAX_GRAPH_VISITED_NODES} visited nodes.`);
    const depth = current.path.length - 1;
    if (depth > 0 && targetKeys.has(current.node.nodeKey)) results.push({ path: current.path, weight: current.weight });
    if (depth >= MAX_GRAPH_DEPTH) continue;
    for (const edge of outgoing.get(current.node.id) ?? []) {
      if (current.ids.includes(edge.toNodeId)) throw new GraphDomainError("GRAPH_CYCLE", "Graph traversal encountered a recursive cycle.");
      const next = nodeById.get(edge.toNodeId);
      if (!next) continue;
      queue.push({
        node: next,
        ids: [...current.ids, next.id],
        path: [...current.path, { type: next.type, key: next.nodeKey, label: next.label }],
        weight: current.weight * edge.weight / 100,
      });
    }
  }
  return results;
}

export function matchGraphEvents(input: {
  graph: WatchGraphRecord;
  intent: WatchIntentRecord;
  events: MarketEventRecord[];
  cursorSequence: number;
  currentSequence: number;
}): GraphMatch[] {
  const graphEffective = Math.min(input.graph.effectiveFromSequence, input.currentSequence);
  const intentEffective = Math.min(input.intent.effectiveFromSequence, input.currentSequence);
  const effectiveSequence = Math.max(input.cursorSequence, graphEffective, intentEffective);
  if (input.graph.status !== "ACTIVE" || input.currentSequence <= effectiveSequence) return [];
  const nodeKeys = new Set(input.graph.nodes.map((node) => node.nodeKey));
  const matches: GraphMatch[] = [];
  for (const event of input.events) {
    if (event.sequence <= effectiveSequence || event.sequence > input.currentSequence || blockedQualities.has(event.quality)) continue;
    const targets = event.subjectKey
      ? new Set(nodeKeys.has(event.subjectKey) ? [event.subjectKey] : [])
      : new Set(event.tags.filter((tag) => nodeKeys.has(tag)));
    if (!targets.size) continue;
    const paths = pathsToTargets(input.graph, targets)
      .map((candidate) => ({ ...candidate, relevance: Math.round(candidate.weight * 100) }))
      .filter((candidate) => candidate.relevance >= MIN_GRAPH_RELEVANCE)
      .sort((a, b) => b.relevance - a.relevance || b.path.length - a.path.length || a.path.map((node) => node.key).join(":").localeCompare(b.path.map((node) => node.key).join(":")));
    const strongest = paths[0];
    if (!strongest) continue;
    matches.push({
      matchType: "GRAPH",
      graphId: input.graph.id,
      graphVersion: input.graph.version,
      logicalIntentId: input.intent.logicalIntentId,
      eventId: event.id,
      eventSubjectKey: event.subjectKey ?? [...targets][0],
      matchedNodeKey: strongest.path.at(-1)?.key ?? "",
      relevance: strongest.relevance,
      pathDepth: strongest.path.length - 1,
      pathWeight: strongest.weight,
      effectiveSequence,
      path: strongest.path,
      event,
    });
  }
  return matches.sort((a, b) => b.relevance - a.relevance || a.logicalIntentId.localeCompare(b.logicalIntentId) || a.eventId.localeCompare(b.eventId));
}
