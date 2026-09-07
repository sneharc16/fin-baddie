import {
  PrismaDemoSessionRepository,
  PrismaInstrumentRepository,
  PrismaKnowledgeCursorRepository,
  PrismaKnowledgeAcknowledgementRepository,
  PrismaMarketEventRepository,
  PrismaMarketSnapshotRepository,
  PrismaWatchIntentRepository,
  PrismaWatchlistRepository,
  PrismaWatchGraphRepository,
} from "@/server/repositories/prisma-repositories";
import { ReplayMarketProvider } from "@/server/market/providers/replay-market-provider";
import { DemoMarketService } from "@/server/services/demo-market-service";
import { InstrumentService } from "@/server/services/instrument-service";
import { MarketQueryService } from "@/server/services/market-query-service";
import { WatchIntentService } from "@/server/services/watch-intent-service";
import { WatchlistService } from "@/server/services/watchlist-service";
import { CatchUpService } from "@/server/services/catch-up-service";
import { WatchGraphService } from "@/server/services/watch-graph-service";
import { IntentLifecycleService } from "@/server/services/intent-lifecycle-service";

const instruments = new PrismaInstrumentRepository();
const watchlists = new PrismaWatchlistRepository();
const intents = new PrismaWatchIntentRepository();
const sessions = new PrismaDemoSessionRepository();
const snapshots = new PrismaMarketSnapshotRepository();
const events = new PrismaMarketEventRepository();
const cursors = new PrismaKnowledgeCursorRepository();
const acknowledgements = new PrismaKnowledgeAcknowledgementRepository();
const graphs = new PrismaWatchGraphRepository();
const market = new ReplayMarketProvider(sessions, snapshots, events);

export const services = {
  instruments: new InstrumentService(instruments),
  watchlist: new WatchlistService(watchlists, instruments, intents, market, cursors),
  watchIntents: new WatchIntentService(intents, instruments, market),
  demo: new DemoMarketService(market, watchlists, cursors, market),
  market: new MarketQueryService(market, watchlists),
  catchUp: new CatchUpService(watchlists, cursors, intents, sessions, market, graphs, acknowledgements),
  watchGraphs: new WatchGraphService(graphs, intents, market),
  intentLifecycle: new IntentLifecycleService(intents, graphs, cursors, acknowledgements, sessions, market),
};
