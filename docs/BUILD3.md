# Build 3

## Implemented

Build 3 adds contextual relevance and the Living Watchlist lifecycle without changing Build 1/2 boundaries. A Watch Intent may own a small, relational, versioned Watch Graph created only after the user confirms a curated driver template. Nodes and edges express configured relevance—not causal probability, price direction, or a recommendation.

The graph engine matches new normalized MarketEvent subjects (or fallback tags) to graph nodes and finds a path from the instrument root. Traversal is deterministic and bounded to three edges and 25 visited nodes. Path relevance multiplies edge weights and must reach 50. Direct Build 2 matches remain relevance 100; otherwise the strongest graph path supplies contextual relevance. Stale/conflicting graph events cannot promote a card, while delayed events retain reduced confidence.

Graph versions have an `effectiveFromSequence`. Edits supersede rather than mutate; events before the later of cursor, intent, and graph effective sequences cannot match. The same demo-only rewind clamp used for intents applies to graphs.

## Living Watchlist

Results, price, dividend, company-event, and supported technical intents become resolution eligible only after their matching evidence occurred and the user acknowledged through its sequence. The user can keep watching, change the reason, or mark it resolved. Results/dividend reasons can renew as a new version for the next cycle. Resolution archives the active graph but never removes the stock. Expired or sufficiently old acknowledged event-specific intents appear under a low-priority review section.

`KnowledgeAcknowledgement` records each advancing per-instrument acknowledgement. Stock history is derived from intent and graph versions, market events/transitions, acknowledgement records, and resolution fields rather than hardcoded timeline copy.

## Deterministic demo

- Steps 0–3 retain Build 2 behavior.
- Step 4 adds a global `CRUDE` event while IndiGo's own price remains quiet.
- The seeded, user-confirmed graph `IndiGo → Fuel cost → Crude` has weights 100 and 85, yielding contextual relevance 85.
- The event has no `driverKey: FUEL_COST`, so Build 2 direct driver equality does not match it.
- Removing Crude creates a new graph version; later Crude subjects no longer promote IndiGo through that graph.

Template weights are fixed prototype relevance inputs, not empirical financial probabilities. Future measurement hooks are documented conceptually as Time to Caught Up, Precision@Attention, Intent Coverage, Stale Intent Rate, and Repeat Surface Rate; no analytics SDK is included.

## Non-goals

Build 3 does not include web research, AI/LLM parsing or summaries, generated company relationships, semantic embeddings, a graph database, live market/news APIs, notifications, Calm Mode, GR-1, authentication, trading, or Buy/Sell recommendations.
