# Fix: static tabs shadowed by DB codex_tabs + runner works with seeded data

**Date:** 2026-07-04
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`

Two "I can't see it" reports, two real root causes (neither was deploy lag).

## 1. Foundation / Experiments / Invariant Intelligence tabs not appearing

**Root cause — DB tab set shadowing static config.** `GET /api/codex/registry/[codexId]` merges `CODEX_DEFINITIONS` tabs with rows from the `codex_tabs` DB table. Both branches used **wholesale replacement**:
- defaults branch: `const mergedTabs = dbTabs.length > 0 ? dbTabs : static`
- primary branch: `tabs: (tabs || []).map(...)` — DB tabs only, no static merge at all

So once *any* `codex_tabs` row existed for a cartridge (true for long-standing cartridges like `agentiq-codex` and `polity-core-cartridge`), the DB set replaced the static set entirely and every newly-added static tab was silently dropped — which is why the additions never appeared across multiple deploys. This directly contradicted the route's own comment ("CODEX_DEFINITIONS takes priority … hand-written configs are canonical and include static component tabs that packs can't express"). The KNYT branch already did it correctly (static as source-of-truth, DB supplies only enabled-state).

**Fix:** added `mergeStaticAndDbTabs(staticTabs, dbTabs)` and applied it to both branches. Static tabs are canonical (carry component configs the DB can't express); DB rows override only `enabled` for matching slugs; genuinely DB-authored tabs (slug absent from the static set — e.g. Codex Manager additions) are appended. When there are no static tabs (a purely DB/pack cartridge) it returns the DB tabs unchanged — a strict no-op in that case. Net effect: new static tabs always appear; DB visibility toggles still respected; nothing regresses for DB-authored tabs.

This is a shared, sensitive route — the change is deliberately minimal and additive-in-effect. The only behavioural change: a static tab whose DB row was *deleted* (rather than disabled) would reappear; hiding is done via `enabled: false`, not row deletion, so the risk is negligible.

## 2. Runner page showed no video generator

**Root cause — the runner required a Level-2 collection, but none exist.** `SkillVideoPlayer` (and its "Generate Video" button) is mounted only after a brief is generated, and the brief required a *semantic collection* selected from a dropdown. The seed created 83 invariants and **zero collections** (collections are created via POST, none are seeded), so the dropdowns were empty, no brief could generate, and the video generator never mounted.

**Fix — namespace-based grounding.** `InvariantVideoExperimentRunner` now grounds on **namespaces**, resolving them to invariant IDs client-side and passing them to the brief API as `invariantIds` groundings (which the API already accepts). Controls: a semantic-namespace picker (constitutional/reasoning/capability/experience/engineering), a "max semantic invariants" cap (highest-standing first), and Style/Narrative include toggles (resolving the 7 seeded style + 5 seeded narrative invariants). This works against the seeded substrate with no collection setup. Curated collections remain supported by the brief API for when they're created. Once "Generate Brief" runs, the real `SkillVideoPlayer` mounts with its "Generate Video" button and the per-segment prompts.

## 3. Invariant data browser (deferred, per operator)

Next once the above are confirmed live: standing/reach/status faceting by namespace, ontology tree, graph view. The Invariant Registry tab (list/filter/detail) already shipped; the richer analytical/graph views are the follow-on.

## Operator actions

None — no migrations, no seed changes. After this deploy: AgentiQ Cartridge → **Memory** group → Foundation + Experiments; Polity Core → **Invariant Intelligence**; iQube Registry → Browse → **Invariants**; `/admin/studio/invariant-video` now generates a brief (and mounts the video generator) directly from the seeded namespaces.

If the tabs *still* don't appear after this deploy, that would rule out the DB-shadow cause and point to a `codex_configs`/routing difference worth a direct DB check — but the multi-deploy persistence makes the shadow the overwhelming likelihood.
