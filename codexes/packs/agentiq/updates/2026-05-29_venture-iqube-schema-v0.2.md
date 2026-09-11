# Venture iQube schema v0.2 — adds Studio, iQube Registry, MoneyPenny (Qc), legal-metaCommons

**Date:** 2026-05-29 (later same day as v0.1)
**Status:** spec · v0.2 · supersedes v0.1
**Surface:** aigentMe (ExperienceQube hydrate + IntentQube generation)
**Schema id:** `https://aigentz.me/schemas/venture-iqube/v0.2.json`

## What changed since v0.1

Operator feedback during the first ChatGPT-populated v0.1 (Operation metaWill) flagged four cartridge bindings the enum couldn't express:

| Slug | Operator surface | Codebase reality today |
|---|---|---|
| `studio` | metaMe Studio (internal enablement layer, future spin-out) | tabGroup `studio` inside the `metame-codex` cartridge |
| `iqube-registry` | iQube Registry / RegistrySupply surface | tab inside the `agentiq-os-cartridge` |
| `moneypenny` | Qc / QriptoCENT micropayments treasury surface | currently a specialist agent; future cartridge home for Qc flows |
| `legal-metacommons` | 2027 deep-commons vertical | not built yet; stub binding so ventures can mark forward dependencies |

v0.2 adds those four slugs to the `cartridgeSlug` enum. **`moneypenny` is the canonical binding for any Qc / treasury / micropayments objective** — operators should use it instead of working around with `metame` + a `moneypenny` partner note.

Bump `schemaVersion` to `"venture-iqube/v0.2"`; aigentMe's ingest mapper accepts both v0.1 and v0.2 (forward-only — once aigentMe sees a v0.2 file under a personaId, the v0.1 file is archived).

## The v0.2 cartridgeSlug enum (full)

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
    "avl",
    "moneypenny",
    "studio",
    "iqube-registry",
    "legal-metacommons"
  ]
}
```

All other v0.1 definitions (operator, strategy, ventures, objectives, plan, planHorizon, kpi, specialistId, horizon) are unchanged. The full v0.1 schema body — copy as the base, then replace only the `cartridgeSlug` block above with this expanded enum and bump `schemaVersion` to `"venture-iqube/v0.2"` — lives in `2026-05-29_venture-iqube-schema-v0.1.md`.

## Sub-surface binding semantics

Three of the new slugs are sub-surfaces today, not standalone top-level cartridges. aigentMe's ingest mapper translates them as follows:

- `studio` → ingest target is the `metame-codex` cartridge with a `tabGroup: studio` filter. NBEs surface inside the metaMe → metaMe Studio tab.
- `iqube-registry` → ingest target is the `agentiq-os-cartridge` cartridge with a `slug: registry-supply` tab filter. NBEs surface inside the AgentiQ OS → Registry tab.
- `moneypenny` → ingest target is the active Qc treasury surface inside whichever cartridge the objective references; if none is specified, the NBE routes through the `moneypenny` specialist for treasury guidance.
- `legal-metacommons` → no live ingest target today; aigentMe records the binding for future hydration but does not surface NBEs against it. Useful for operators marking 2027-horizon objectives so the plan stays forward-coherent.

When v0.3+ promotes any of these to a real top-level cartridge (most likely `studio`, when the spin-out lands), the ingest mapper's sub-surface translation becomes a passthrough and operator-level bindings work without re-ingest.

## Operator prompt update for ChatGPT

When you re-prompt ChatGPT, swap the previous schema for the v0.1 body with the new enum block above + `schemaVersion: "venture-iqube/v0.2"`. The exact instruction:

> The Venture iQube schema has been bumped to v0.2. The cartridgeSlug enum now includes four additional slugs: `studio`, `iqube-registry`, `moneypenny`, and `legal-metacommons`. Re-emit Operation metaWill's Venture iQube JSON with:
>
> 1. `schemaVersion: "venture-iqube/v0.2"`.
> 2. Studio Blueprint venture binds `studio` (not `metame` + `venture-lab`).
> 3. AgentiQ OS / iQube Registry venture binds `iqube-registry` alongside `agentiq-os`.
> 4. QriptoCENT / Qc Micropayments venture binds `moneypenny` as primary (drop the `metame, knyt, qriptopian, venture-lab` workarounds).
> 5. Polity Strategy Cartridge venture binds `legal-metacommons` so the 2027 deep-commons-vertical objective lands on a real (stub) binding instead of being hidden in the notes field.
> 6. All other fields unchanged. Validate strictly against the v0.2 enum and emit a single JSON file.

## Why this isn't a refactor

The schema is a serialization format, not a data store. v0.1 → v0.2 changes one enum value list, the operator re-emits, aigentMe ingests the new file (idempotent against persona). No migration to write because the old v0.1 file simply gets superseded under the same `personaId`.

## What still has to land

- `/api/persona/venture-iqube/ingest` route — accepts v0.1 + v0.2, validates via ajv against the bundled JSON Schema, hydrates ExperienceQube + IntentQube. Tracked in the v0.1 doc's "How aigentMe will ingest it" section.
- UploadDrawer `useKind: "venture_iqube"` — same persona-uploads pattern, new `use_kind` enum value.
- Operator-facing "Export Venture iQube" button — emits the live state back as a downloadable JSON file for partner sharing.

Those three pieces still ship together when the ingest route lands — no schema-side change needed.
