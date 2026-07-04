# Invariant Registry — the browsing UI (closes the visibility gap)

**Date:** 2026-07-04
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Builds on:** all Chrysalis Foundation phases + Law XII/XIII/XIV, same day.

## What shipped

The gap flagged in the previous session doc — "the live invariant DATA has no browsing UI, API-only" — is closed.

**New tab:** AgentiQ cartridge → Registry group → **"Invariant Registry"** (after Registry/RegistrySupply). Lists every invariant with:
- Namespace filter chips (clickable, shows live counts per namespace)
- Namespace / status dropdown filters + debounced text search (all server-side via existing `GET /api/invariants` query params)
- Sort by Standing, Reach, or recency
- Grid/table view (reusing the generic `ViewModeToggle` and `Pagination` from `components/registry/` — both already iQube-agnostic, confirmed by reading their prop interfaces before reuse)
- Standing and Reach rendered as separate 5-dot gauges (reusing `Dots` from `components/iqube/scoreUtils.tsx` via its `colorClass`/`kind` escape hatch — `kind="reliability"` and `kind="trust"` are repurposed purely for their higher-is-better color ramp; the visible label comes from the `title` prop, so there's no semantic collision with the metaMe R/T dots protocol, which governs a different, unrelated primitive)

**New detail view:** clicking any invariant opens `InvariantDetailModal` — statement, namespace/status/semantic-type/seed-id badges, confidence + basis, Standing/Reach with their accumulator counts (validated/contradicted/referenced/used), contexts (domains of applicability), and graph edges rendered with the *other side's actual statement* (not a raw UUID) — the detail API route was extended to batch-resolve neighbor statements in the same call.

**New API:** `GET /api/invariants/[id]` — invariant + contexts + edges + neighbor summaries, one round trip. Spine-gated, read-only.

## Why it took this shape (Law II compliance)

A research pass across `TabRenderer.tsx`, `IQubeRegistryBrowseTab.tsx`, and `components/registry/*` confirmed the exact mechanism before writing anything:
- Tab components resolve through a single flat `componentRegistry` object literal in `app/triad/components/codex/TabRenderer.tsx` (not `CodexPanelDynamic.tsx`) — the only way to wire a new interactive tab is an import + a registry-object entry there, then a `config.component` string match in `data/codex-configs.ts`.
- `Pagination` and `ViewModeToggle` are genuinely generic (no iQube-specific fields) — reused as-is.
- `FilterSection` is hardcoded to iQube business-model vocabulary (Buy/Sell/Rent/...) — **not** reused; the invariant filter bar is hand-rolled, matching what `IQubeRegistryBrowseTab.tsx` itself does (it doesn't use `FilterSection` either).
- `IQubeDetailModal` (1071 lines, iQube-specific mint/fork/BlakQube logic) was mirrored for *shape* only (self-fetch-by-id, `fixed inset-0` overlay, `onClose` prop) — a fresh, much smaller component was written rather than extending it.

## Scope note

No ontology tree widget: today's ontology is exactly 7 root classes (one per namespace, no sub-classes yet ratified), so a tree would duplicate the namespace filter chips. The namespace-chip strip with live counts serves that purpose until sub-classes exist, at which point a real tree becomes worth building.

## Operator actions

None — no new migrations, no seed changes. Live after the next deploy: AgentiQ cartridge → Registry → Invariant Registry.
