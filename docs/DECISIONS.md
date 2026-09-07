# Architecture decisions

## ADR-001: No live market API

**Decision:** Build 1 uses only `ReplayMarketProvider` behind `MarketDataProvider`.

**Reason:** Product and test behavior must be transparent, reproducible, and independent of external credentials, outages, rate limits, or licensing. Every replay value is labeled as simulated.

## ADR-002: Deterministic replay

**Decision:** Scenario snapshots, volumes, times, and event IDs are fixed fixtures; the current position is persisted.

**Reason:** The same action must produce the same result for demos and automated tests, and browser refresh must not reset state.

## ADR-003: Money in paise

**Decision:** Monetary database/domain fields are integer paise.

**Reason:** Binary floating-point is unsafe for durable monetary identity and comparison. Decimal formatting happens only at presentation boundaries.

## ADR-004: Versioned Watch Intent

**Decision:** Edits supersede and append instead of overwriting.

**Reason:** User context remains auditable and later attention items can be reproduced against the exact intent version that existed at the time.

## ADR-005: Immutable market events

**Decision:** Events are append-oriented and corrections point to an earlier event.

**Reason:** Historical facts remain explainable; corrected data does not silently rewrite the evidence used by later calculations.

## ADR-006: No authentication

**Decision:** All requests use the correctly modeled, seeded `demo-user`.

**Reason:** Authentication is outside Build 1. Keeping user ownership in the schema avoids coupling current domain behavior to that temporary omission.

## ADR-007: Modular monolith, no microservices

**Decision:** Use a single full-stack repository and process.

**Reason:** Build 1 has no independent scaling or deployment need that justifies operational complexity. Internal interfaces provide sufficient extensibility.

## ADR-008: Business logic outside UI and routes

**Decision:** React renders DTOs, routes adapt HTTP, services enforce use cases, repositories own persistence, and providers own market-source behavior.

**Reason:** Boundaries make rules independently testable and allow later UI, persistence, or market-provider changes without duplicating domain logic.

## ADR-009: Reads do not acknowledge knowledge

**Decision:** GET requests and page visits never advance a Knowledge Cursor; only an explicit acknowledgement command does.

**Reason:** Observing a rendered page is not reliable evidence that the user consumed every change.

## ADR-010: Knowledge Cursors are monotonic

**Decision:** Cursor updates conditionally advance only when the requested sequence is newer, with an atomic version increment.

**Reason:** Concurrent or stale clients must never move user knowledge backwards.

## ADR-011: Attention remains derived

**Decision:** Build 2 computes AttentionItems from market facts, active intents, and cursor state rather than persisting cards.

**Reason:** The result stays reproducible and automatically reflects acknowledgement without creating a second source of market truth.

## ADR-012: Deterministic direct intent matching

**Decision:** Build 2 matches only explicit structured payload fields and event types.

**Reason:** Exact rules are explainable and testable. Semantic inference and graph traversal remain later-build work.

## ADR-013: Intent versions have market-effective sequences

**Decision:** Every WatchIntent version records the current market sequence when it is created.

**Reason:** New or edited reasons must not reinterpret information that predates those reasons.

## ADR-014: Significance and relevance are separate

**Decision:** Objective market significance is calculated independently from direct user-intent relevance.

**Reason:** A large move can be worth noting without matching why a user watches, while a precise watch condition can matter without a large generic move.

## ADR-015: Attention score is internal

**Decision:** The exact weighted score orders deterministic results but is not shown as a consumer-facing number.

**Reason:** A prominent pseudo-precise score would imply a predictive model that Build 2 does not have.

## ADR-016: Transitions matter more than persistent states

**Decision:** Price-level conditions match only when the ordered snapshot series enters or crosses a saved condition.

**Reason:** Remaining inside a range or above a level after acknowledgement is not new information.

## ADR-017: Expected movement is simulated metadata

**Decision:** Replay snapshots carry fixed expected one-step move basis points.

**Reason:** Deterministic volatility-normalized demos require a stable input. It is explicitly not claimed as real market volatility.

## ADR-018: One consumer card per instrument

**Decision:** Signals inside one cursor window aggregate into a single AttentionItem for each instrument.

**Reason:** This reduces consumer noise without prematurely implementing general semantic event clustering.

## ADR-019: Relational Watch Graphs

**Decision:** Store small user-specific graphs as PostgreSQL node and edge tables, not Neo4j.

**Reason:** The bounded prototype graph fits the existing modular monolith and does not justify separate infrastructure.

## ADR-020: Relationships require confirmation

**Decision:** Curated templates are suggestions; only explicit user confirmation creates a matching graph.

**Reason:** Context should reflect what the user chose to track, not an opaque product assertion.

## ADR-021: Weights represent relevance

**Decision:** Edge weights are deterministic relevance strength, not causal probability or predicted impact.

**Reason:** The system explains context without claiming direction, certainty, or a recommendation.

## ADR-022: Bounded traversal

**Decision:** Traverse no more than three edges or 25 nodes.

**Reason:** Small bounds keep behavior understandable and guard malformed graphs from uncontrolled recursion.

## ADR-023: Immutable graph versions

**Decision:** Relationship edits supersede and append, with a market-effective sequence.

**Reason:** Historical meaning remains explainable and new relationships do not retroactively match old events.

## ADR-024: Context is not a recommendation

**Decision:** Graph matches say a configured relationship changed; they never infer bullish/bearish outcomes.

**Reason:** Relevance to a watch question does not establish causal direction or an investment action.

## ADR-025: Resolution follows acknowledgement

**Decision:** A matching event makes a resolvable intent eligible only after the user cursor has crossed it.

**Reason:** An event occurring and the user consuming its update are different states.

## ADR-026: Resolution does not remove stocks

**Decision:** Resolving the last reason leaves the watchlist item active.

**Reason:** Cleanup remains user-controlled and intent lifecycle is separate from watchlist membership.

## ADR-027: Curated templates before generated graphs

**Decision:** Build 3 exposes only deterministic product-authored templates.

**Reason:** They are auditable and testable without LLMs, external research, or unsupported causal claims.

## ADR-028: Normalized event descriptors

**Decision:** Add subject and tags while preserving each event's typed payload. Subject is authoritative when present; tags are fallback descriptors.

**Reason:** A generic matching surface enables graph traversal, while subject precedence ensures removing a specifically tracked driver cannot be bypassed by a broader tag.

## ADR-029: Acknowledgement history complements cursors

**Decision:** Persist one per-instrument acknowledgement row for both individual and mark-all commands.

**Reason:** Cursor state remains compact and monotonic while timeline/audit views retain action history without duplicating watchlist-wide entries.
