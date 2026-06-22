# VentureQube operatingModel layer — knowledge artifact vs operating artifact

**Date:** 2026-06-22
**Branch:** `claude/optimistic-davinci-exiykx`
**Status:** shipped (schemas + types + persistence + ingest)

## The decision

The core VentureQube — both the v0.x operator wrapper (operator, strategy,
experienceGoals, experienceGuide, standing, plan, ventures, portfolio) and the
13-layer v1.0 venture — is a **knowledge artifact**: a general-purpose operating
primitive a student, founder, creator, venture studio, family office, or polity
steward can all use unchanged. We deliberately do **not** hardwire day-to-day
operations ("daily actions", "campaigns", "commercial-operating goals") into it;
doing so would over-specialise a powerful general primitive.

Instead, operations get **one new optional layer** — `operatingModel` — added
**only to Venture Pro and Venture Portfolio** (never Lite, never Core
Experience, never inside a `VentureQubeV1`). Three concerns, three homes:

| Layer | Captures |
|---|---|
| Experience | intent |
| Venture | execution structure |
| **operatingModel** | **action** (the Chief-of-Staff brief) |

This turns the portfolio from a static document into a **living operational
brief aigentMe executes against** as Chief of Staff — without changing the
constitutional structure of the primitive.

## The operatingModel block

```json
"operatingModel": {
  "mission": "Operation Leap",
  "successMetrics": ["4,000 Passport holders", "$100K MRR", "25 Founder Office conversions"],
  "activeObjectives": [],
  "priorityPartners": ["Project Liberty", "Horizon", "Lamina1"],
  "priorityActions": [],
  "reviewCadence": "weekly",
  "primaryMetric": "Net Value Acceleration — have our actions collapsed time to value?"
}
```

### The primary metric is Net Value Acceleration

The most interesting portfolio-level KPI is not revenue, users, or tasks
completed — it is **"did this action reduce the time required to achieve
meaningful value?"** That aligns the whole portfolio: Passport adoption reduces
time to citizenship, aigentMe reduces time to agency, Standing reduces time to
trust, Founder Office reduces time to venture readiness. `primaryMetric` defaults
to this framing and rolls up every venture's verified outcome accrual (the
`ProofOfOutcomeClaim` / Net Value Acceleration work shipped earlier today).

## What shipped

- **Type** `VentureOperatingModel` in `types/ventureQube.ts` — a standalone
  interface, explicitly NOT part of `VentureQubeV1`.
- **Download schemas** — optional top-level `operatingModel` block added to
  `ventureQube-pro-schema.json` and `ventureQube-portfolio-schema.json`, with
  the knowledge-vs-operating-artifact rationale in each `_agent_briefing`. The
  core schema and the per-venture shape are untouched.
- **Persistence** — `services/venture/venturePortfolio.ts`: `operatingModel`
  read from / written to the existing `venture_portfolios.payload` jsonb (read-
  merge, no migration). `saveVenturePortfolio` accepts it; `getVenturePortfolio`
  returns it; `VenturePortfolio` carries it.
- **API** — `POST /api/venture/portfolio` accepts `operatingModel`;
  `GET` returns it (so aigentMe / the portfolio surfaces can read the brief).
- **Ingest** — `app/api/persona/venture-iqube/ingest/route.ts` threads
  `operatingModel` through `materializeProVentures` → `saveVenturePortfolio`.
  It persists even on a Pro upload with no `portfolio` block.

## Not done (follow-on)

- A wizard/cockpit UI surface to author + display the operatingModel brief (the
  schema, persistence, and API are ready). Today it round-trips via upload +
  the portfolio API.
