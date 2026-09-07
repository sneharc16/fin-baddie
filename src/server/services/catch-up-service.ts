import { analyzeInstrument } from "@/domain/attention/analyze-instrument";
import { AppError } from "@/lib/errors/app-error";
import { DEFAULT_DEMO_SESSION_ID } from "@/lib/constants";
import type { AcknowledgeInput } from "@/lib/validation/catch-up";
import type { MarketDataProvider } from "@/server/market/providers/market-data-provider";
import type { DemoSessionRepository, KnowledgeAcknowledgementRepository, KnowledgeCursorRepository, WatchGraphRepository, WatchIntentRepository, WatchlistRepository } from "@/server/repositories/contracts";
import { toAttentionItemDto, toCursorDto, toIntentLifecycleDto } from "@/server/dto/mappers";
import type { AttentionItemDto, CatchUpDto } from "@/server/dto/types";
import { evaluateIntentLifecycle } from "@/domain/intent/lifecycle";

const scoreOrder = (a: AttentionItemDto, b: AttentionItemDto) => b.score - a.score || a.instrument.symbol.localeCompare(b.instrument.symbol);

export class CatchUpService {
  constructor(
    private readonly watchlists: WatchlistRepository,
    private readonly cursors: KnowledgeCursorRepository,
    private readonly intents: WatchIntentRepository,
    private readonly sessions: DemoSessionRepository,
    private readonly market: MarketDataProvider,
    private readonly graphs: WatchGraphRepository,
    private readonly acknowledgements: KnowledgeAcknowledgementRepository,
  ) {}

  async getCatchUp(userId: string): Promise<CatchUpDto> {
    const [watchlist, state] = await Promise.all([
      this.watchlists.getDefaultForUser(userId),
      this.sessions.getById(DEFAULT_DEMO_SESSION_ID),
    ]);
    if (!watchlist) throw new AppError("WATCHLIST_NOT_FOUND", "The default watchlist has not been seeded.", 404);
    if (!state) throw new AppError("INVALID_MARKET_STATE", "The demo market state is unavailable.", 409);
    const instrumentIds = watchlist.items.map((item) => item.instrumentId);
    if (instrumentIds.length === 0) {
      return {
        asOfSequence: state.currentSequence,
        asOfTime: state.currentTime.toISOString(),
        cursorSummary: { allAtSameSequence: true, minimumSequence: state.currentSequence, maximumSequence: state.currentSequence, commonLastSeenTime: state.currentTime.toISOString() },
        relevant: [], significant: [], quiet: [], counts: { relevant: 0, significant: 0, quiet: 0 }, intentLifecycle: [], reviewReasons: [],
      };
    }
    const [cursorRows, intentRows, snapshots] = await Promise.all([
      this.cursors.listForInstruments(userId, instrumentIds),
      this.intents.listActiveForInstruments(userId, instrumentIds),
      this.market.getSnapshotsForAnalysis(instrumentIds, state.currentSequence),
    ]);
    if (cursorRows.length !== instrumentIds.length) throw new AppError("CURSOR_NOT_FOUND", "A watched instrument is missing its knowledge cursor.", 409);
    const minimumCursor = Math.min(...cursorRows.map((cursor) => cursor.lastSeenSequence));
    const graphRows = await this.graphs.listActiveForIntentLogicalIds(userId, intentRows.map((intent) => intent.logicalIntentId));
    const earliestEvidence = Math.min(minimumCursor, ...intentRows.map((intent) => Math.min(intent.effectiveFromSequence, state.currentSequence)), ...graphRows.map((graph) => Math.min(graph.effectiveFromSequence, state.currentSequence)));
    const events = await this.market.getEventsBetween(earliestEvidence, state.currentSequence);
    const cursorByInstrument = new Map(cursorRows.map((cursor) => [cursor.instrumentId, cursor]));
    const items = watchlist.items.map((watchlistItem) => {
      const cursor = cursorByInstrument.get(watchlistItem.instrumentId);
      if (!cursor) throw new AppError("CURSOR_NOT_FOUND", `No knowledge cursor exists for ${watchlistItem.instrument.symbol}.`, 409);
      const result = analyzeInstrument({
        instrument: watchlistItem.instrument,
        cursor,
        currentSequence: state.currentSequence,
        currentTime: state.currentTime,
        snapshots: snapshots.filter((snapshot) => snapshot.instrumentId === watchlistItem.instrumentId),
        events: events.filter((event) => (event.instrumentId === watchlistItem.instrumentId || event.instrumentId === null) && event.sequence > cursor.lastSeenSequence),
        activeIntents: intentRows.filter((intent) => intent.instrumentId === watchlistItem.instrumentId),
        activeGraphs: graphRows.filter((graph) => graph.instrumentId === watchlistItem.instrumentId),
      });
      if (!result) throw new AppError("INVALID_MARKET_STATE", `Market snapshots are incomplete for ${watchlistItem.instrument.symbol}.`, 409);
      return toAttentionItemDto(result);
    });
    const relevant = items.filter((item) => item.lane === "RELEVANT").sort(scoreOrder);
    const significant = items.filter((item) => item.lane === "SIGNIFICANT").sort(scoreOrder);
    const quiet = items.filter((item) => item.lane === "QUIET").sort((a, b) => a.instrument.symbol.localeCompare(b.instrument.symbol));
    const intentLifecycle = intentRows.map((intent) => {
      const cursor = cursorByInstrument.get(intent.instrumentId);
      if (!cursor) throw new AppError("CURSOR_NOT_FOUND", "A watched instrument is missing its knowledge cursor.", 409);
      return toIntentLifecycleDto(evaluateIntentLifecycle({
        intent,
        cursor,
        snapshots: snapshots.filter((snapshot) => snapshot.instrumentId === intent.instrumentId),
        events: events.filter((event) => event.instrumentId === intent.instrumentId),
        currentSequence: state.currentSequence,
        currentTime: state.currentTime,
      }));
    }).sort((a, b) => a.instrumentId.localeCompare(b.instrumentId) || a.logicalIntentId.localeCompare(b.logicalIntentId));
    const reviewReasons = intentLifecycle.filter((intent) => intent.state === "RESOLUTION_ELIGIBLE" || intent.state === "STALE_CANDIDATE");
    const allAtSameSequence = cursorRows.every((cursor) => cursor.lastSeenSequence === cursorRows[0]?.lastSeenSequence);
    const commonTimes = new Set(cursorRows.map((cursor) => cursor.lastSeenEventTime?.toISOString() ?? null));
    return {
      asOfSequence: state.currentSequence,
      asOfTime: state.currentTime.toISOString(),
      cursorSummary: {
        allAtSameSequence,
        minimumSequence: minimumCursor,
        maximumSequence: Math.max(...cursorRows.map((cursor) => cursor.lastSeenSequence)),
        commonLastSeenTime: allAtSameSequence && commonTimes.size === 1 ? [...commonTimes][0] : null,
      },
      relevant,
      significant,
      quiet,
      counts: { relevant: relevant.length, significant: significant.length, quiet: quiet.length },
      intentLifecycle,
      reviewReasons,
    };
  }

  async acknowledge(userId: string, input: AcknowledgeInput) {
    const [watchlist, state] = await Promise.all([
      this.watchlists.getDefaultForUser(userId),
      this.sessions.getById(DEFAULT_DEMO_SESSION_ID),
    ]);
    if (!watchlist) throw new AppError("WATCHLIST_NOT_FOUND", "The default watchlist has not been seeded.", 404);
    if (!state) throw new AppError("INVALID_MARKET_STATE", "The demo market state is unavailable.", 409);
    if (input.throughSequence > state.currentSequence) {
      throw new AppError("INVALID_ACK_SEQUENCE", "Cannot acknowledge beyond the current market sequence.", 409);
    }
    const activeIds = new Set(watchlist.items.map((item) => item.instrumentId));
    const requestedIds = "scope" in input ? [...activeIds] : [...new Set(input.instrumentIds)];
    const invalid = requestedIds.find((id) => !activeIds.has(id));
    if (invalid) throw new AppError("INSTRUMENT_NOT_WATCHED", "Acknowledgement is limited to active watchlist instruments.", 404);
    const snapshots = await this.market.getSnapshotsAtOrBefore(requestedIds, input.throughSequence);
    const previousCursors = await this.cursors.listForInstruments(userId, requestedIds);
    const previousByInstrument = new Map(previousCursors.map((cursor) => [cursor.instrumentId, cursor]));
    const snapshotByInstrument = new Map(snapshots.map((snapshot) => [snapshot.instrumentId, snapshot]));
    const updated = await Promise.all(requestedIds.map(async (instrumentId) => {
      const snapshot = snapshotByInstrument.get(instrumentId);
      if (!snapshot) throw new AppError("INVALID_MARKET_STATE", `No snapshot exists through sequence ${input.throughSequence}.`, 409);
      const cursor = await this.cursors.advanceMonotonic(userId, {
        instrumentId,
        sequence: input.throughSequence,
        eventTime: snapshot.eventTime,
        snapshotId: snapshot.id,
      });
      if (!cursor) throw new AppError("CURSOR_NOT_FOUND", "The knowledge cursor does not exist.", 409);
      const previous = previousByInstrument.get(instrumentId);
      if (previous && previous.lastSeenSequence < input.throughSequence) {
        await this.acknowledgements.create({
          userId,
          instrumentId,
          fromSequence: previous.lastSeenSequence,
          throughSequence: input.throughSequence,
          scope: "scope" in input ? "WATCHLIST" : "INSTRUMENT",
          acknowledgedAt: new Date(),
        });
      }
      return toCursorDto(cursor);
    }));
    return { throughSequence: input.throughSequence, cursors: updated };
  }
}
