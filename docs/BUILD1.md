# Build 1

## Implemented

Build 1 delivers the complete foundation for Groww Delta:

- application shell and responsive product UI;
- seeded user, instruments, watchlist, watchlist items, Watch Intents, cursor baselines, snapshots, events, and demo session;
- database-backed add/archive/re-add watchlist behavior;
- multiple Watch Intents per instrument, discriminated payload validation, provenance, versioned edit history, and archive;
- deterministic four-position replay with persisted advance/reset controls;
- current snapshot and occurred-event APIs behind a market-provider abstraction;
- Catch Up baseline language that does not claim intelligence;
- unit, service, replay, and Playwright smoke coverage;
- Prisma migration, idempotent seed, Docker Compose PostgreSQL, and developer commands.

## Reserved for Build 2

Build 1 intentionally does not calculate meaningful change, relevance, attention, event clustering, or user-specific summaries. It does not automatically advance Knowledge Cursors or define acknowledgement semantics. Those capabilities remain outside this build; the persisted events, snapshots, intents, and cursor baselines are the extension foundation.

The UI therefore reports only the replay position and current simulated state. It never fabricates “things that matter” or recommendations.
