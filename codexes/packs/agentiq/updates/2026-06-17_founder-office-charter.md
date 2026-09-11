# Founder Office Charter — sub-metaCommons constitutional artefact

**Date:** 2026-06-17
**Surface:** Polity Core cartridge
**Branch:** `claude/optimistic-davinci-exiykx`

## What changed

Added **The Founder Office Charter** to Polity Core as a **constitutional-grade
sub-metaCommons artefact** — not a top-level peer of the Constitution. It sits
**under** the metaCommons Charter and is **calibrated by** the Standing Charter.
Founder Office is downstream of the metaCommons: it consumes the Commons signals
the metaCommons surfaces and transforms them into actionable opportunities.

This is the constitutional foundation for the forthcoming **Founder Operator
Venture Blueprint** workstream (PRD + schema pending from the operator).

- Human-readable: `FOUNDER_OFFICE_CHARTER.md` (verbatim), surfaced as a new
  cartridge tab in the frameworks group (collection `col_founder_office_charter`).
  The doc header marks it as a sub-metaCommons artefact and cross-links the
  metaCommons + Standing charters.
- Machine-readable: `founder-office-charter.v1.json` with
  `classification: "sub_metacommons_artefact"`, `subCharterOf: "metacommons-charter"`,
  `calibratedBy: "standing-charter"`; exposed via `getFounderOfficeCharter()` and
  included in `getConstitutionalFramework()` (served by
  `GET /api/polity-core/constitution`).
- Added to the Autodrive publish (script + admin endpoint) and the Amendment
  Records (v1.0.0).

## Scope / what it is NOT

- **NOT part of the Agent Passport binding triple** (constitution + agent-charter
  + delegation). It is a metaCommons sub-charter, not an agent-governing
  framework, so `CURRENT_CONSTITUTIONAL_VERSIONS` is unchanged.
- **Constitutional only.** The operational Founder Office (the Founder Operator
  Venture Blueprint engine — capability discovery, opportunity intelligence,
  venture formation) is a later workstream awaiting the operator's PRD + schema.
- References PoWP/PoTS, which are defined in the Polity Paper series (Qriptopian
  codex) — backlogged for ingestion as constitutional commentary.

## Key principles encoded

- Founder Office is the **primary institutional interface** between founders and
  the metaCommons.
- **Standing calibrates confidence in signals; it does not determine who receives
  opportunities.**
- Purpose is **venture formation, capability development, and value creation** —
  **not extraction**.

## Files
- `codexes/packs/polity-core/items/FOUNDER_OFFICE_CHARTER.md`
- `services/polity/frameworks/founder-office-charter.v1.json`
- `services/polity/constitution.ts`
- `app/api/polity-core/publish/route.ts`, `scripts/publish-polity-core.mjs`
- `codexes/packs/polity-core/collections.json`, `data/codex-configs.ts`
- `codexes/packs/polity-core/items/AMENDMENT_RECORDS.md`

## Operator action

Re-run `POST /api/polity-core/publish` (admin) on dev to capture the Autodrive
CID for the Founder Office Charter (and the still-pending Standing + metaCommons
charter CIDs), then record them in `AMENDMENT_RECORDS.md` and
`services/polity/frameworks/autodrive-cids.json`.
