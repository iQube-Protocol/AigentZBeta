# Venture iQube schema v0.3 — AVL → MVL rename (cartridgeSlug)

**Date:** 2026-05-29
**Status:** spec · v0.3 · supersedes v0.2 (which superseded v0.1)
**Surface:** aigentMe (ExperienceQube hydrate + IntentQube generation)
**Schema id:** `https://aigentz.me/schemas/venture-iqube/v0.3.json`

## What changed since v0.2

AgentiQ Venture Lab is now metaMe Venture Lab; the `avl` / `AVL` references across the codebase are being renamed to `mvl` / `MVL` to match. The cartridgeSlug enum tracks the codebase, so v0.3 swaps `avl` for `mvl`.

| v0.2 | v0.3 | Reason |
|---|---|---|
| `avl` | `mvl` | AgentiQ Venture Lab → metaMe Venture Lab rename |

All other v0.2 additions (`studio`, `iqube-registry`, `moneypenny`, `legal-metacommons`) are preserved.

## The v0.3 cartridgeSlug enum (full)

```json
"cartridgeSlug": {
  "type": "string",
  "enum": [
    "metame",
    "knyt",
    "qriptopian",
    "marketa",
    "agentiq-os",
    "venture-lab",
    "mvl",
    "moneypenny",
    "studio",
    "iqube-registry",
    "legal-metacommons"
  ]
}
```

All other v0.2 definitions (operator, strategy, ventures, objectives, plan, planHorizon, kpi, specialistId, horizon) are unchanged. Bump `schemaVersion` to `"venture-iqube/v0.3"`.

## Ingest acceptance

`/api/persona/venture-iqube/ingest` now accepts v0.1, v0.2, **and v0.3** payloads (forward-only — when a v0.3 file lands under a personaId, v0.2 / v0.1 files for the same persona are archived).

The Phase A2 ExperienceQube hydration mapper translates `avl` → `mvl` if it appears in a v0.1 or v0.2 payload's `ventures[].cartridgeBindings[]`, so operators on older files don't need to re-emit immediately — but `avl` will eventually be dropped from the ingest acceptlist in v0.4.

## Operator prompt to re-emit

> The Venture iQube schema has been bumped to v0.3. The cartridgeSlug enum has had `avl` renamed to `mvl` to match the AgentiQ Venture Lab → metaMe Venture Lab rename in the codebase. Re-emit Operation metaWill's Venture iQube JSON with:
>
> 1. `schemaVersion: "venture-iqube/v0.3"`.
> 2. Every venture binding that previously listed `avl` now lists `mvl` instead.
> 3. All other fields unchanged. Validate strictly against the v0.3 enum and emit a single JSON file.

## Data fix

A new SQL migration (`20260529000001_active_cartridges_avl_to_mvl.sql`) rewrites any existing `experience_qubes.active_cartridges` row that contains `'avl'` to `'mvl'` in place, idempotent. Operator action: run it in Supabase SQL editor once.

## Roadmap stays

v0.4 will likely drop `avl` from the ingest acceptlist (after operators have migrated) and add reputation/treasury blocks per the v0.1 roadmap. v0.5+ promotes Venture iQube to a first-class `VentureQube` class.
