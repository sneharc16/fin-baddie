import { AppError } from "@/lib/errors/app-error";
import type { KnowledgeCursorRepository, WatchlistRepository } from "@/server/repositories/contracts";
import type { MarketDataProvider } from "@/server/market/providers/market-data-provider";
import type { DemoMarketController, DemoMarketState } from "@/server/market/providers/demo-market-controller";
import type { DemoStateDto } from "@/server/dto/types";

export class DemoMarketService {
  constructor(
    private readonly controller: DemoMarketController,
    private readonly watchlists: WatchlistRepository,
    private readonly cursors: KnowledgeCursorRepository,
    private readonly market: MarketDataProvider,
  ) {}

  private toDto(state: DemoMarketState): DemoStateDto {
    return {
      scenario: state.scenario,
      currentStep: state.position.currentStep,
      currentSequence: state.position.currentSequence,
      currentTime: state.position.currentTime.toISOString(),
      atFinalStep: state.atFinalStep,
    };
  }

  async getState() {
    const state = await this.controller.getDemoState();
    if (!state) throw new AppError("DEMO_SESSION_NOT_FOUND", "The default demo session has not been seeded.", 404);
    return this.toDto(state);
  }

  async advance(): Promise<DemoStateDto & { advanced: boolean; message?: string }> {
    const state = await this.controller.advanceDemo();
    if (!state) throw new AppError("DEMO_SESSION_NOT_FOUND", "The default demo session has not been seeded.", 404);
    return { ...this.toDto(state), advanced: state.advanced, ...(state.message ? { message: state.message } : {}) };
  }

  async reset(userId: string) {
    const resetState = await this.controller.resetDemo();
    const watchlist = await this.watchlists.getDefaultForUser(userId);
    if (!watchlist) throw new AppError("WATCHLIST_NOT_FOUND", "The default watchlist has not been seeded.", 404);
    const instrumentIds = watchlist.items.map((item) => item.instrumentId);
    const snapshots = await this.market.getSnapshotsAtOrBefore(instrumentIds, resetState.position.currentSequence);
    if (snapshots.length !== instrumentIds.length) throw new AppError("INVALID_MARKET_STATE", "Initial replay snapshots are incomplete.", 409);
    await this.cursors.resetMany(userId, snapshots.map((snapshot) => ({
      instrumentId: snapshot.instrumentId,
      sequence: resetState.position.currentSequence,
      eventTime: snapshot.eventTime,
      snapshotId: snapshot.id,
    })));
    return { ...this.toDto(resetState), reset: true };
  }
}
