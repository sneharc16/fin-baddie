# Build 2

## Implemented

Build 2 turns Catch Up into a deterministic comparison between the current replay position and each instrument's persisted knowledge baseline. `CatchUpService` reads active watchlist items, cursors, active intent versions, bounded snapshots, and events, then invokes the storage-independent attention analyzer. GET analysis has no writes.

Users explicitly acknowledge one stock with **Mark seen** or every active stock with **Mark all caught up**. Cursor advancement is monotonic and server-derived: the client supplies only the requested instrument scope and sequence, while the server resolves the snapshot, simulated event time, and current market limit. Adding or re-adding a stock baselines it at the current sequence. Demo reset returns active cursors to Step 0 while retaining watchlists and full intent history.

## Meaningful-change pipeline

For each active instrument, the analysis window starts after its Knowledge Cursor and ends at the persisted DemoSession sequence. The engine compares a baseline snapshot with the current snapshot, inspects every intermediate snapshot, and considers only events inside the window. Intent matching additionally starts after the intent version's `effectiveFromSequence`.

Objective significance combines three centrally configured signals:

- volatility-normalized price surprise, with a documented absolute-basis-point fallback when expected movement is unavailable;
- cumulative volume relative to expected cumulative volume;
- deterministic market-event significance.

The maximum signal becomes the base significance. Two or more non-zero signals add 10, capped at 100. The internal score is:

`0.30 × significance + 0.35 × relevance + 0.15 × novelty + 0.10 × urgency + 0.10 × confidence`

Results are classified as `RELEVANT` when a direct intent matched, `SIGNIFICANT` when no intent matched but significance is at least 50, and otherwise `QUIET`. The score only orders cards within lanes; the UI does not present it as an investment rating.

## Direct intent matching

Build 2 uses structured rules only. Price watches require an ordered transition into/through their condition, and stale or conflicting snapshots cannot confirm those transitions. Earnings match quarter/focus, technical events match setup and optional reference level, drivers match exact keys, and dividend/company-event intents match structured corporate-event fields. `LONG_TERM` and `GENERAL` do not create direct relevance in this build.

## Default replay behavior

- Step 0: baseline; all instruments are caught up.
- Step 1: ordinary movement remains below the attention threshold.
- Step 2: structured market state yields four direct Watch Intent matches and one objectively significant unmatched instrument.
- After Step 2 acknowledgement: the current attention lists are empty.
- Step 3 after that acknowledgement: prior Step 2 transitions and events do not repeat.

Expected one-step movement and expected-volume values are fixed simulated modeling inputs. During demo-only clock reset, a future intent effective sequence is clamped to the current replay sequence for analysis. Production market sequence remains monotonic.

## Non-goals

Build 2 does not include Thesis/Driver Graph inference, semantic free-text parsing, LLMs or AI summaries, general event clustering, Calm Mode, notifications, live market/news APIs, conflict-resolution workflows, authentication, trading, or Buy/Sell recommendations.
