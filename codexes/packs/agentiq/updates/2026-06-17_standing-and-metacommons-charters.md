# Standing Charter + metaCommons Charter — first-class Polity Core docs

**Date:** 2026-06-17
**Surface:** Polity Core cartridge
**Branch:** `claude/optimistic-davinci-exiykx`

## What changed

Added **The Standing Charter** and **The metaCommons Charter** as first-class
constitutional documents in Polity Core, both human- and machine-readable,
mirroring the Constitution / Agent Charter / Delegation Framework pattern.

- Human-readable: `STANDING_CHARTER.md`, `METACOMMONS_CHARTER.md` (verbatim),
  surfaced as new cartridge tabs (collections `col_standing_charter`,
  `col_metacommons_charter`).
- Machine-readable: `standing-charter.v1.json`, `metacommons-charter.v1.json`;
  exposed via `getStandingCharter()` / `getMetacommonsCharter()` and included in
  `getConstitutionalFramework()` (served by `GET /api/polity-core/constitution`).
- Both added to the Autodrive publish (script + admin endpoint) and the
  Amendment Records.

## Correction — agents DO hold Standing

Operator correction: **participant agents** (participant-passport-bearing
entities) **do hold Standing** (the veracity-confidence measure). What they lack
is **citizenship and inalienable rights** — their rights are **participatory and
revocable**. The earlier `STANDING_FRAMEWORK.md` (which wrongly said agents hold
no standing) is corrected to v1.0.1 and reframed as the operational companion to
the Standing Charter. The Standing Charter and its machine-readable form encode
the holder model: citizens (Standing + citizenship + inalienable rights) vs
participant agents / organizations / institutions (Standing only).

Note: the Agent Charter's "no constitutional standing" refers to **governance /
rights standing**, which is distinct from the metaCommons **Standing** (veracity)
that participant agents do hold.

## Scope

Constitutional documents only. The **metaCommons engine** (PoWP aggregation, the
Commons field, PoTS learning) is a later workstream. **PoWP / PoTS** are defined
in the Polity Paper series (Qriptopian codex) — backlogged for ingestion as
constitutional commentary (see
`2026-06-17_polity-paper-series-ingest-backlog.md`). Not added to the Agent
Passport binding triple (constitution + agent-charter + delegation).

## Files
- `codexes/packs/polity-core/items/{STANDING_CHARTER,METACOMMONS_CHARTER}.md`
- `codexes/packs/polity-core/items/STANDING_FRAMEWORK.md` (corrected)
- `services/polity/frameworks/{standing-charter,metacommons-charter}.v1.json`
- `services/polity/constitution.ts`, `app/api/polity-core/publish/route.ts`, `scripts/publish-polity-core.mjs`
- `codexes/packs/polity-core/collections.json`, `data/codex-configs.ts`
- `codexes/packs/polity-core/items/AMENDMENT_RECORDS.md`
