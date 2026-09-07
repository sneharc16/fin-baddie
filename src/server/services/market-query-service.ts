import type { MarketDataProvider } from "@/server/market/providers/market-data-provider";
import type { WatchlistRepository } from "@/server/repositories/contracts";
import { AppError } from "@/lib/errors/app-error";
import { toEventDto, toSnapshotDto } from "@/server/dto/mappers";

export class MarketQueryService {
  constructor(
    private readonly market: MarketDataProvider,
    private readonly watchlists: WatchlistRepository,
  ) {}

  async currentForWatchlist(userId: string) {
    const watchlist = await this.watchlists.getDefaultForUser(userId);
    if (!watchlist) throw new AppError("WATCHLIST_NOT_FOUND", "The default watchlist has not been seeded.", 404);
    return (await this.market.getCurrentSnapshots(watchlist.items.map((item) => item.instrumentId))).map(toSnapshotDto);
  }

  async eventsSince(sequence: number) {
    return (await this.market.getEventsSince(sequence)).map(toEventDto);
  }
}
