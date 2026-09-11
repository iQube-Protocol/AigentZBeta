# Invariant data browser — Overview / Ontology / Graph views

**Date:** 2026-07-04
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Builds on:** the Invariant Registry tab (list/filter/detail), same day.

## What shipped

The deferred analytical layer over the live invariant substrate. The Invariant
Registry tab is now a **four-view surface** behind one view-switcher, not just a
list:

- **Browse** — the existing list/filter/search + Standing/Reach dots + detail
  modal (unchanged behaviour, now one view among four).
- **Overview** — Standing/Reach/status **faceting by namespace**: per-namespace
  cards (count, avg Standing, avg Reach, status mini-strip), Standing and Reach
  **distribution histograms** (five 0–10 buckets each), whole-substrate status
  distribution, and Highest-Standing / Highest-Reach leaderboards. Standing
  (validation-class, purple) and Reach (adoption, cyan) are rendered on
  **separate axes with distinct hues** — never conflated (Law XII).
- **Ontology** — the **class tree** (CFS-002) from `GET /api/ontology`, each
  class annotated with the count of invariants classified under it (direct +
  subtree Σ), plus an "unclassified in this namespace" line so no invariant is
  invisible. Clicking a class jumps to Browse filtered to that ontology class.
  Renders the real recursive structure, so ratified sub-classes appear
  automatically once they exist (today it's one root per namespace — extending
  it is a constitutional act, CFS-002 §7).
- **Graph** — a **traversal explorer** over the edge set (CFS-003 §4): pick a
  root invariant, walk its neighbourhood by direction (out/in/both) and depth
  (1–4), rendered as **inline SVG** with a depth-radial layout (root centre, one
  ring per depth). Nodes coloured by namespace; contradiction (rose) and
  supersession (amber) edges are colour-loud, all others muted; edge type shows
  on hover; clicking a node opens its detail modal. No graph library, no
  external assets (CSP-safe).

## No new backend

All four views run against surfaces that already existed after Phases 1–3:
`GET /api/invariants` (list — returns full records incl. `ontologyClassId`),
`GET /api/invariants/[id]` (detail), `GET /api/invariants/graph` (traversal),
`GET /api/ontology` (class tree). **Zero new API routes, migrations, or seed
changes.**

## Files

- `app/triad/components/codex/tabs/invariantViewShared.ts` — **new**. One
  canonical home for the namespace/status enumerations, colour ramps
  (`NAMESPACE_COLOR` tags, `NAMESPACE_FILL` solids, `NAMESPACE_HEX` for SVG),
  the `InvariantRow` wire type, and `loadAllInvariants()`. Prevents palette
  drift across the four views.
- `app/triad/components/codex/tabs/InvariantOverviewView.tsx` — **new**. Facets.
- `app/triad/components/codex/tabs/InvariantOntologyView.tsx` — **new**. Tree.
- `app/triad/components/codex/tabs/InvariantGraphView.tsx` — **new**. Explorer.
- `app/triad/components/codex/tabs/InvariantRegistryTab.tsx` — refactored into a
  shell with the view switcher; the Browse body is unchanged, now gated behind
  `view === 'browse'` and extended with an `ontology` filter param so the
  Ontology click-through works. The list only fetches while Browse is active.

Reuse discipline (Law II): `Dots`, `Pagination`, `ViewModeToggle`,
`personaFetch`, and `InvariantDetailModal` are all reused verbatim from the
browse tab. `FilterSection` is still **not** reused (hardcoded to iQube
business-model vocabulary). No new component registration — the tab is already
wired into `TabRenderer.tsx`'s `componentRegistry` and rendered by both the
AgentiQ and iQube Registry cartridges.

## Scope notes

- The Graph explorer traverses from a single chosen root (the API's contract).
  A "whole-graph" force layout was deliberately not built — with hundreds of
  invariants it would be an unreadable hairball; rooted traversal is the
  explainability primitive CFS-003 §4 actually defines.
- The Ontology tree is shallow today (7 roots, no ratified sub-classes) but
  renders recursively, so it needs no change when sub-classes are ratified.

## Operator actions

None — no migrations, no seed changes. Live after the next deploy: iQube
Registry → Browse → **Invariants** (and AgentiQ mirror) → the **Overview /
Ontology / Graph** view tabs alongside Browse.
