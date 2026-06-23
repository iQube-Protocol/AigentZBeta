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

## Refinements (operator architecture review)

Three small adjustments after review, plus the UI surface:

1. **No separate operating thesis.** `portfolio.thesis` is the single
   highest-order statement of intent (the Why); `operatingModel.mission` is its
   operational expression (the What-right-now). One thesis prevents strategic
   and operating intent from drifting apart (tactical drift).
2. **`operatingModel` is REQUIRED at Portfolio level** (still optional on Pro).
   A portfolio without an operating model is just a collection of ventures; with
   one it is an operating system aigentMe can execute. Enforced in the portfolio
   download schema (`required: [...,"operatingModel"]` + `operatingModel.required:
   ["mission"]`) and in the ingest validator (`operatingModel.mission` required
   for `venture-iqube-portfolio/v1.0`).
3. **`activeObjectives` gains lifecycle status** — now
   `{ objective, status: 'active'|'completed'|'blocked'|'deferred' }[]` so
   aigentMe can distinguish what to act on. **`nextReviewDate`** added alongside
   `reviewCadence` (cadence = how often; date = when → auto-generated review
   briefs). No task/PM/CRM/Kanban constructs — it stays an iQube.

**PoTS / Time-to-Value layering (closure):** one idea, three framings, no new
primitives — public mental model = Time-to-Value; internal metric = Proof of
Time Saved (PoTS); constitutional principle = Net Value Acceleration
(Time-to-Value minus Risk Repair Burden). Reflected in `primaryMetric`'s default
and in the polity-papers PoTS commentary.

## The surface (shipped)

- **Author** — the Venture Portfolio wizard ("My Portfolio") gains an
  *Operating brief* section: mission (+ mic), primary metric, success metrics,
  active objectives (text + status), priority partners, priority actions, review
  cadence, next review date. Saves through `POST /api/venture/portfolio`.
- **Display** — `VentureLabPortfolioTab` renders a read-only *Operating Brief*
  panel (fed by `GET /api/venture/portfolio`) at the top of the portfolio view,
  refreshed after a wizard save. So the brief has a persistent home, not just an
  edit modal.

## Convenience entry point + tier gating

The operating brief is **portfolio-scoped** (one per persona on
`venture_portfolios`) and gated to **Pro / Elite** only —
`portfolioWizard = ventureTier === 'pro' || 'elite'` (Lite gets the Pro wizard
and one venture, but NOT the Portfolio view/iQube). So it is authored in the
Portfolio wizard, not the per-venture Pro wizard.

To bridge the two without duplicating data, the Venture Pro wizard now takes an
optional `onOpenOperatingBrief` callback. When the operator has Portfolio access
(Pro/Elite, or admin), the Founder Office and Standing-cartridge launchers pass
it, rendering a link in the Pro wizard — "This is one venture — set the
portfolio-wide operating brief →" — that closes Pro and opens the Portfolio
wizard. Lite-tier operators (no Portfolio access) never see the link, matching
the tier model. The nested Pro wizard inside the Portfolio wizard does not get
the link (it would be circular).

## Not done (follow-on)

- Load the operating brief into aigentMe's grounding context so it generates
  daily review briefs against it (the data + API are ready). This is the
  "load into aigentMe → generate daily briefs → run 30 days" execution step —
  no longer schema work.
