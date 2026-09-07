# Groww Delta

> A living watchlist that remembers **why you are watching**, **what you already know**, and **what changed that actually matters**.

**Live Demo:** https://groww-delta-dusky.vercel.app/  
**GitHub:** https://github.com/sneharc16/groww-delta

---

## Problem

A traditional watchlist remembers *which stocks* a user follows, but not *why* they are following them.

As the list grows, users repeatedly scan prices, news, results and alerts to answer a simple question:

> **Did anything happen that actually matters to me?**

The same update can also appear repeatedly even after the user has already seen it, while important contextual events may be missed because the stock itself has barely moved.

---

## Product Pitch

Groww Delta turns a watchlist into a memory of why each stock matters. Users save a watch reason, and Delta compares new market states with what they have already seen. A deterministic Attention Engine classifies updates as Relevant, Significant or Quiet, while a user-confirmed Driver Graph surfaces contextual changes such as crude oil affecting IndiGo through fuel costs. We chose persistent server-side state, bounded traversal and explainable rules for reproducibility and trust. Future scope includes live-data trust and correction handling, per-user isolation, Calm Mode, corporate-action safeguards, accessibility, performance hardening, scalability testing and production deployment readiness.

---

## What Groww Delta Does

Delta introduces three pieces of state that a normal watchlist does not retain:

- **Watch Intent** — why the user is watching a stock
- **Knowledge Cursor** — what the user has already seen
- **Driver Graph** — user-confirmed relationships that can make an external event relevant

New information is then classified into:

- **Relevant** — directly or contextually matches the user's reason
- **Significant** — important market movement even without an intent match
- **Quiet** — does not deserve the user's attention

Once an update is acknowledged, the Knowledge Cursor advances so the same information does not keep resurfacing.

---

## Architecture

Groww Delta is implemented as a **layered monolith**: simple to deploy, but with business logic separated from presentation and persistence.

```mermaid
flowchart TB

    U[User]

    subgraph UI["Presentation"]
        CU[Catch Up]
        WL[Watchlist]
        SD[Stock Detail]
        DEMO[Demo Controls]
    end

    subgraph APP["Application Services"]
        CS[Catch-Up Service]
        WS[Watchlist Service]
        AS[Acknowledgement Service]
        DS[Replay Service]
        LS[Lifecycle Service]
    end

    subgraph DOMAIN["Domain"]
        AE[Attention Engine]
        IM[Intent Matching]
        KC[Knowledge Cursor]
        DG[Driver Graph]
        SG[Significance Analysis]
    end

    subgraph DATA["Data"]
        RP[Replay Market Provider]
        PR[Prisma]
        DB[(PostgreSQL / Neon)]
    end

    U --> UI

    CU --> CS
    WL --> WS
    SD --> WS
    DEMO --> DS

    CS --> AE
    AS --> KC

    AE --> IM
    AE --> SG
    AE --> DG
    AE --> KC
    AE --> RP

    CS --> PR
    WS --> PR
    AS --> PR
    DS --> PR
    LS --> PR

    PR --> DB
```

---

## User Journey

```mermaid
flowchart TD

    A[Add Stock] --> B[Save Watch Reason]
    B --> C[Optional: Confirm Drivers]
    C --> D[Market State Changes]

    D --> E{Deserves Attention?}

    E -->|No| F[You're Caught Up]
    E -->|Intent Match| G[Relevant]
    E -->|Unusual Move| H[Significant]
    E -->|Driver Match| I[Contextually Relevant]

    G --> J[Explain Why]
    H --> J
    I --> J

    J --> K[User Reviews Update]
    K --> L[Mark Seen / Mark All Caught Up]
    L --> M[Advance Knowledge Cursor]

    M --> N{Watch Reason Fulfilled?}

    N -->|No| D
    N -->|Yes| O[Resolve / Change / Keep Watching]
```

---

## Attention Engine

The ranking logic is deterministic and explainable.

```text
Attention =
    0.30 × Significance
  + 0.35 × Relevance
  + 0.15 × Novelty
  + 0.10 × Urgency
  + 0.10 × Confidence
```

A direct Watch Intent match receives maximum relevance.

Contextual relevance can also come from the user-confirmed Driver Graph. For example:

```text
IndiGo → Fuel Cost → Crude
```

A material crude-oil event can therefore become relevant to an IndiGo watch reason even when IndiGo itself barely moves.

Graph traversal is bounded to keep contextual reasoning predictable:

```text
Maximum depth:                  3
Maximum visited nodes:          25
Minimum contextual relevance:   50
```

---

## Demo Walkthrough

The product includes a deterministic five-step replay so evaluators can reproduce the important behaviours without relying on live financial APIs.

| Step | Expected behaviour |
|---|---|
| **0 — Baseline** | All 5 stocks are quiet |
| **1 — Normal movement** | Prices move, but nothing deserves attention |
| **2 — Meaningful changes** | 4 Relevant + 1 Significant |
| **3 — Novelty test** | Acknowledged information does not repeat |
| **4 — Contextual relevance** | IndiGo surfaces through `IndiGo → Fuel Cost → Crude` |

### Quick evaluation flow

1. Open the **Demo** tab.
2. Click **Reset scenario**.
3. Advance to Step 1 and open **Catch Up** — the user should remain caught up.
4. Advance to Step 2 — four watch reasons should match and Reliance should appear as Significant.
5. Click **Mark all caught up**.
6. Advance to Step 3 — the old information should not return.
7. Advance to Step 4 — IndiGo should surface because crude moved materially through the confirmed fuel-cost relationship.

All replay data is explicitly labelled **SIMULATED · DEMO DATA**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend / Server | Next.js 16, React 19 |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Production DB | Neon |
| Validation | Zod |
| Testing | Vitest + Playwright |
| Deployment | Vercel |
| Package Manager | pnpm |

---

## Local Setup

### Prerequisites

Install:

- Node.js
- pnpm
- PostgreSQL, or use a hosted PostgreSQL database such as Neon

The repository uses:

```text
pnpm@11.25.0
```

### 1. Clone the repository

```bash
git clone https://github.com/sneharc16/groww-delta.git
cd groww-delta
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure the database

Copy the environment example:

```bash
cp .env.example .env
```

Set:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Do not commit real database credentials.

### 4. Generate Prisma Client

```bash
pnpm db:generate
```

### 5. Apply migrations

```bash
pnpm db:migrate:deploy
```

### 6. Seed the deterministic demo

```bash
pnpm db:seed
```

### 7. Start the application

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

---

## Validation

Useful commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The current build includes:

- 100 unit / service / integration tests
- 7 Playwright end-to-end tests
- strict TypeScript validation
- lint validation
- production build validation
- database migration validation

---

## Key Engineering Choices

**Deterministic attention logic**  
The decision path remains reproducible and inspectable instead of relying on an opaque ranking model.

**Server-side source of truth**  
Watch reasons, acknowledgements, lifecycle state and replay position are persisted rather than stored only in the browser.

**Bounded contextual reasoning**  
Driver relationships are user-confirmed and traversal is deliberately limited.

**Layered monolith**  
The project keeps clear domain boundaries without introducing unnecessary distributed-system complexity.

**Reproducible demo data**  
Evaluation does not depend on external market APIs or their availability.

---

## Project Structure

```text
groww-delta/
├── data/replay/        # deterministic market scenario
├── docs/               # design/build documentation
├── prisma/             # schema, migrations and seed
├── src/
│   ├── app/            # UI and API routes
│   ├── domain/         # attention, intent and graph logic
│   └── services/       # application services
├── tests/
├── package.json
└── README.md
```

---

## Safety

Groww Delta is an information-attention prototype.

It:

- does not place trades,
- does not recommend buying or selling securities,
- uses simulated market information for the demo,
- and explains why each surfaced item earned attention.

---

## Author

**Sneha Roychowdhury**  
Final Year Undergraduate  
B.Tech Electronics and Communication Engineering - Artificial Intelligence (ECE-AI)  
Indira Gandhi Delhi Technical University for Women (IGDTUW), Delhi

**GitHub:** https://github.com/sneharc16  
**LinkedIn:** https://www.linkedin.com/in/snehaaroychowdhury/

---

## Disclaimer

Groww Delta is a prototype created for demonstration purposes using simulated market data. It is not investment advice, financial research, or a trading system.
