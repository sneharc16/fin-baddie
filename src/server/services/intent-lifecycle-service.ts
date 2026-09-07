import { randomUUID } from "node:crypto";
import { earningsPayloadSchema } from "@/domain/intent/schemas";
import { evaluateIntentLifecycle, nextQuarterLabel } from "@/domain/intent/lifecycle";
import { buildWatchTimeline } from "@/domain/intent/timeline";
import { summarizeIntent } from "@/domain/intent/summary";
import { AppError } from "@/lib/errors/app-error";
import { renewIntentSchema } from "@/lib/validation/intent-lifecycle";
import { DEFAULT_DEMO_SESSION_ID } from "@/lib/constants";
import type { MarketDataProvider } from "@/server/market/providers/market-data-provider";
import type { DemoSessionRepository, KnowledgeAcknowledgementRepository, KnowledgeCursorRepository, WatchGraphRepository, WatchIntentRepository } from "@/server/repositories/contracts";
import { toIntentDto, toIntentLifecycleDto } from "@/server/dto/mappers";

export class IntentLifecycleService {
  constructor(
    private readonly intents: WatchIntentRepository,
    private readonly graphs: WatchGraphRepository,
    private readonly cursors: KnowledgeCursorRepository,
    private readonly acknowledgements: KnowledgeAcknowledgementRepository,
    private readonly sessions: DemoSessionRepository,
    private readonly market: MarketDataProvider,
  ) {}

  private async state() {
    const state = await this.sessions.getById(DEFAULT_DEMO_SESSION_ID);
    if (!state) throw new AppError("INVALID_MARKET_STATE", "The demo market state is unavailable.", 409);
    return state;
  }

  async getInstrument(userId: string, instrumentId: string) {
    const state = await this.state();
    const [intentRows, cursorRows, snapshots, events, acknowledgements] = await Promise.all([
      this.intents.listForInstrument(userId, instrumentId),
      this.cursors.listForInstruments(userId, [instrumentId]),
      this.market.getSnapshotsForAnalysis([instrumentId], state.currentSequence),
      this.market.getEventsBetween(0, state.currentSequence),
      this.acknowledgements.listForInstrument(userId, instrumentId),
    ]);
    const cursor = cursorRows[0];
    if (!cursor) throw new AppError("CURSOR_NOT_FOUND", "The knowledge cursor does not exist.", 409);
    const logicalIds = [...new Set(intentRows.map((intent) => intent.logicalIntentId))];
    const graphHistory = (await Promise.all(logicalIds.map((id) => this.graphs.listForIntent(userId, id)))).flat();
    const latest = logicalIds.flatMap((id) => {
      const version = intentRows.filter((intent) => intent.logicalIntentId === id).sort((a, b) => b.version - a.version)[0];
      return version ? [version] : [];
    });
    const lifecycle = latest.map((intent) => toIntentLifecycleDto(evaluateIntentLifecycle({ intent, cursor, snapshots, events: events.filter((event) => event.instrumentId === instrumentId), currentSequence: state.currentSequence, currentTime: state.currentTime })));
    const timeline = buildWatchTimeline({ intents: intentRows, graphs: graphHistory, acknowledgements, snapshots, events: events.filter((event) => event.instrumentId === instrumentId || event.instrumentId === null), currentSequence: state.currentSequence });

    return { lifecycle, timeline: timeline.map((entry) => ({ ...entry, occurredAt: entry.occurredAt.toISOString() })) };
  }

  async resolve(userId: string, logicalIntentId: string) {
    const [current, state] = await Promise.all([this.intents.findCurrent(userId, logicalIntentId), this.state()]);
    if (!current) throw new AppError("WATCH_INTENT_NOT_FOUND", "No active watch reason was found.", 404);
    const resolved = await this.intents.resolveCurrent(current.id, new Date(), state.currentSequence);
    await this.graphs.archiveActiveForIntent(userId, logicalIntentId);
    return toIntentDto(resolved);
  }

  async keepWatching(userId: string, logicalIntentId: string) {
    const [current, state] = await Promise.all([this.intents.findCurrent(userId, logicalIntentId), this.state()]);
    if (!current) throw new AppError("WATCH_INTENT_NOT_FOUND", "No active watch reason was found.", 404);
    return toIntentDto(await this.intents.keepWatching(current.id, state.currentSequence));
  }

  async renew(userId: string, logicalIntentId: string, untrusted: unknown) {
    const input = renewIntentSchema.parse(untrusted);
    const [previous, state] = await Promise.all([this.intents.findLatest(userId, logicalIntentId), this.state()]);
    if (!previous || previous.status !== "RESOLVED") throw new AppError("INTENT_NOT_RESOLVED", "Resolve the current watch reason before watching the next cycle.", 409);
    if (previous.type !== "EARNINGS" && previous.type !== "DIVIDEND") throw new AppError("INTENT_NOT_RENEWABLE", "Only results and dividend watch reasons can renew to a next cycle.", 400);
    let structuredPayload = previous.structuredPayload;
    let originalText = previous.originalText;
    if (previous.type === "EARNINGS") {
      const parsed = earningsPayloadSchema.parse(previous.structuredPayload);
      const quarterLabel = input.quarterLabel ?? nextQuarterLabel(parsed.quarterLabel);
      structuredPayload = { ...parsed, quarterLabel };
      const focus = parsed.focus[0].replaceAll("_", " ").toLowerCase();
      originalText = `Watching ${quarterLabel} ${focus}`;
    } else {
      originalText = "Watching the next dividend event";
    }
    const renewed = await this.intents.renew(previous.id, {
      id: randomUUID(), logicalIntentId, userId, instrumentId: previous.instrumentId, version: previous.version + 1,
      effectiveFromSequence: state.currentSequence, supersedesId: previous.id, type: previous.type, originalText,
      structuredPayload, provenanceSource: "STOCK_DETAIL", provenanceReference: null, horizon: previous.horizon,
      expiresAt: null,
    });
    const graphHistory = await this.graphs.listForIntent(userId, logicalIntentId);
    const latestGraph = graphHistory[0];
    if (latestGraph && latestGraph.status === "ARCHIVED") {
      const nodeIds = new Map(latestGraph.nodes.map((node) => [node.id, randomUUID()]));
      await this.graphs.createVersion(latestGraph.id, {
        id: randomUUID(), logicalGraphId: latestGraph.logicalGraphId, userId, instrumentId: latestGraph.instrumentId,
        watchIntentLogicalId: logicalIntentId, version: latestGraph.version + 1, provenance: latestGraph.provenance,
        templateKey: latestGraph.templateKey, effectiveFromSequence: state.currentSequence, supersedesId: latestGraph.id,
        nodes: latestGraph.nodes.map((node) => ({ id: nodeIds.get(node.id)!, nodeKey: node.nodeKey, type: node.type, label: node.label, metadata: (node.metadata ?? {}) as Record<string, string | number | boolean> })),
        edges: latestGraph.edges.map((edge) => ({ id: randomUUID(), fromKey: "", toKey: "", relationship: edge.relationship, weight: edge.weight, fromNodeId: nodeIds.get(edge.fromNodeId)!, toNodeId: nodeIds.get(edge.toNodeId)! })),
      });
    }
    return { intent: toIntentDto(renewed), summary: summarizeIntent(renewed) };
  }
}
