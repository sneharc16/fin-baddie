import { randomUUID } from "node:crypto";
import type { WatchGraphRecord } from "@/domain/graph/types";
import { findDriverTemplate, graphDraftFromTemplate, templatesForIntent } from "@/domain/graph/templates";
import { GraphDomainError } from "@/domain/graph/validation";
import { AppError } from "@/lib/errors/app-error";
import { saveWatchGraphSchema } from "@/lib/validation/watch-graph";
import type { MarketDataProvider } from "@/server/market/providers/market-data-provider";
import type { WatchGraphRepository, WatchIntentRepository } from "@/server/repositories/contracts";
import { toWatchGraphDto } from "@/server/dto/mappers";

function rethrowGraphError(error: unknown): never {
  if (error instanceof GraphDomainError) throw new AppError(error.code, error.message, 400);
  throw error;
}

export class WatchGraphService {
  constructor(
    private readonly graphs: WatchGraphRepository,
    private readonly intents: WatchIntentRepository,
    private readonly market: MarketDataProvider,
  ) {}

  private async activeIntent(userId: string, logicalIntentId: string) {
    const intent = await this.intents.findCurrent(userId, logicalIntentId);
    if (!intent) throw new AppError("WATCH_INTENT_NOT_FOUND", "No active watch reason was found.", 404);
    return intent;
  }

  async suggestions(userId: string, logicalIntentId: string) {
    const intent = await this.activeIntent(userId, logicalIntentId);
    return templatesForIntent(intent.instrumentId, intent.type).map((template) => ({
      templateKey: template.key,
      templateLabel: template.label,
      description: template.description,
      nodes: template.nodes.filter((node) => node.selectable).map((node) => ({
        key: node.nodeKey,
        label: node.label,
        type: node.type,
        description: node.description ?? "Configured relationship",
        selectedByDefault: node.selectedByDefault ?? false,
      })),
    }));
  }

  async get(userId: string, logicalIntentId: string) {
    if (!(await this.intents.findLatest(userId, logicalIntentId))) throw new AppError("WATCH_INTENT_NOT_FOUND", "The watch reason was not found.", 404);
    const history = await this.graphs.listForIntent(userId, logicalIntentId);
    const current = history.find((graph) => graph.status === "ACTIVE") ?? null;
    return { current: current ? toWatchGraphDto(current) : null, history: history.map(toWatchGraphDto) };
  }

  async create(userId: string, logicalIntentId: string, untrusted: unknown) {
    if (await this.graphs.findActive(userId, logicalIntentId)) throw new AppError("WATCH_GRAPH_EXISTS", "This watch reason already has confirmed related drivers.", 409);
    return this.save(userId, logicalIntentId, untrusted, null);
  }

  async edit(userId: string, logicalIntentId: string, untrusted: unknown) {
    const previous = await this.graphs.findActive(userId, logicalIntentId);
    if (!previous) throw new AppError("WATCH_GRAPH_NOT_FOUND", "No active related-driver configuration was found.", 404);
    return this.save(userId, logicalIntentId, untrusted, previous);
  }

  private async save(userId: string, logicalIntentId: string, untrusted: unknown, previous: WatchGraphRecord | null) {
    const input = saveWatchGraphSchema.parse(untrusted);
    const intent = await this.activeIntent(userId, logicalIntentId);
    try {
      const template = findDriverTemplate(input.templateKey, intent.instrumentId);
      if (!template.applicableIntentTypes.includes(intent.type)) {
        throw new GraphDomainError("DRIVER_TEMPLATE_NOT_APPLICABLE", "This curated template does not apply to the selected watch reason type.");
      }
      const selectable = new Set(template.nodes.filter((node) => node.selectable).map((node) => node.nodeKey));
      if (input.selectedNodeKeys.some((key) => !selectable.has(key))) {
        throw new GraphDomainError("INVALID_GRAPH_NODE_SELECTION", "Related drivers must come from the selected curated template.");
      }
      const draft = graphDraftFromTemplate(template, input.selectedNodeKeys);
      const graphId = randomUUID();
      const nodeIds = new Map(draft.nodes.map((node) => [node.nodeKey, randomUUID()]));
      const graph = await this.graphs.createVersion(previous?.id ?? null, {
        id: graphId,
        logicalGraphId: previous?.logicalGraphId ?? randomUUID(),
        userId,
        instrumentId: intent.instrumentId,
        watchIntentLogicalId: logicalIntentId,
        version: (previous?.version ?? 0) + 1,
        provenance: "CURATED_TEMPLATE",
        templateKey: template.key,
        effectiveFromSequence: await this.market.getCurrentSequence(),
        supersedesId: previous?.id ?? null,
        nodes: draft.nodes.map((node) => ({ ...node, id: nodeIds.get(node.nodeKey)! })),
        edges: draft.edges.map((edge) => ({ ...edge, id: randomUUID(), fromNodeId: nodeIds.get(edge.fromKey)!, toNodeId: nodeIds.get(edge.toKey)! })),
      });
      return toWatchGraphDto(graph);
    } catch (error: unknown) {
      return rethrowGraphError(error);
    }
  }
}
