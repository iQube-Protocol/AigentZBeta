# Generalized customer matrix + Venture Lab commercial funnel (Step 3 groundwork)

**Date:** 2026-06-21
**Surface:** Venture Lab cartridge
**Branch:** `claude/optimistic-davinci-exiykx`

## Context

The Studio (ComposerStudio) already renders a generalized customer matrix
(Engagement × Sovereignty Journey, cell→NBE, Org/Cohort/Individual lenses) — but
its LIVE data feed (`dashboard?view=matrix`) is hardwired to
`nakamoto_knyt_personas` (KNYT-only). Operator direction: generalize the feed,
and consolidate the venture-progress and customer-progress matrices in Venture
Lab (a matrix funnel, not a one-dimensional one).

## What shipped

### Generalized customer-matrix feed (not KNYT-specific)
- `services/venture/customerMatrix.ts` — `getCustomerMatrix(admin, { tenantId })`
  reads the generic `journey_states` substrate and emits cell counts in the exact
  `Engagement:Sovereignty` key vocabulary the Studio grid consumes (drop-in
  compatible). Axes locked to the Studio's: Engagement (Recipient→Steward) ×
  Sovereignty Journey (Disheartened→Architect). v1 stage→X / depth→Y mapping is
  explicit + documented + tunable. Works for any tenant; omit tenantId for the
  whole-platform (metaMe) funnel.
- `GET /api/venture/customer-matrix?tenantId=` — admin-gated (aggregates across
  personas). The KNYT-hardwired `dashboard?view=matrix` is left untouched (zero
  risk to the live KNYT Studio); pointing the Studio's metaMe lens at this new
  generic feed is a one-line follow-up.

### Venture Lab consolidation surface
- `VentureFunnelTab` — new **Commercial Funnel** tab in `VENTURE_LAB_CODEX`
  consolidating both matrices on one surface:
  - **Venture progress** — growth matrix (maturity × commercialization), one dot
    per venture, zone-coloured (from `/api/venture-lab/portfolio`).
  - **Customer progress** — the generalized customer matrix (engagement ×
    sovereignty), heatmapped, with a scope selector (Platform / metaMe / KNYT).
  - Goal annotated as top-right (Architect × Steward = founder-operators), tying
    the funnel apex to the commercial spine.
- Registered in `TabRenderer.tsx`.

## Why this shape
- Two assessed entities, kept distinct: the growth matrix tracks **the venture**;
  the customer matrix tracks **the venture's customers**. Consolidated in one
  Venture Lab surface = the matrix funnel.
- monetization (Founder Office Pro) is the **apex zone** of the customer matrix,
  not a separate axis — so Step 4 gating maps onto "customers reaching top-right."

## Follow-ups
- Point ComposerStudio's metaMe matrix lens at `/api/venture/customer-matrix`
  (replace the KNYT-only fetch) — small change, verify in-app.
- Tune the v1 journey-stage → sovereignty / depth → engagement mapping with the
  operator once live cells are observed.
- Per-venture customer attribution (today the customer matrix scopes by tenant;
  new ventures inherit it once they carry their own customer journeys).
