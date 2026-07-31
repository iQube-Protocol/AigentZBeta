# Parked follow-ons closed: CFS-007 renderer seam · knowledge initialization · EXP-003 benchmark

**Date:** 2026-07-04
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Constitutional anchor:** CFS-007 (Law VI), CFS-006 §3 / CFS-008 §5, CFS-008 §2.

Three commits, one concern each.

## 1. Session-start knowledge initialization (CFS-006 §3)

`initializeKnowledge(context)` in the Invariant Service: canonical context-slice roots +
their `depends_on`/`composes` dependency closure, as a T1-safe manifest. Cached per
**(context, canon version)** in the house Map+TTL+inflight style (mirrors
`services/identity/fioCache.ts`); the canon version is a new
`getCanonVersionStamp()` — max `updated_at` over knowledge statuses — so supersession
anywhere in the canon invalidates on the next probe (probed at most once/60s; manifests
reused for 10 min within a version). A young canon with nothing ratified `canonical`
falls back to `validated` knowledge rather than initializing empty.

**Consumer:** the main multi-persona copilot route (`/api/codex/chat` — the
highest-traffic LLM surface). The manifest loads inside the route's existing parallel
fetch and renders as a "Validated Invariants — Canonical Memory" block in the
platform/system agents' system prompts (aigent-me, aigent-z, aigent-c…), with seedId
markers matching the specialist-router citation convention. KNYT content personas keep
their tighter prompt budget. Enrichment-only: failures degrade to an ungrounded turn.
Also fixed in passing: `grounding.ts` imported from `./index` (a latent circular
import) — now direct module imports.

## 2. CFS-007 — the named rendering seam (Law VI)

`types/experienceRenderer.ts`: `ExperienceRenderer<TOutput>` +
`ExperiencePrescription` + `CitizenContext` + `RendererCapabilities` +
`normalizeExperienceDepth` (the single documented bridge for the `mini_rt` (wire) vs
`mini_runtime` (type) mismatch the recon surfaced). React-free so both bundles import it.
Adapters wrap — they do not rewrite — and are registered where their mechanism runs
(deliberately no cross-bundle runtime registry; the liquid path is client React, the
generative path is server-side):

- **`liquid`** (`liquidTemplates/liquidExperienceRenderer.ts`) — wraps
  `liquidTemplateRegistry`. `TabRenderer`'s liquid-ui branch now resolves through the
  adapter instead of the raw registry lookup; behaviour-identical, but template
  resolution + context binding now cross a named, reviewable seam.
- **`a2ui`** (`services/a2ui/a2uiExperienceRenderer.ts`) — wraps the surface-plan →
  A2UI payload flow; the `a2ui_generate_surface_payload` CopilotKit action is now a
  caller of the adapter rather than carrying the flow inline.

**Latent bug fixed while wiring:** TWO divergent copies of the liquid registry existed
(`registry.ts` and `registry.tsx`) — `.ts` registered `knyt:living_canon_v1` but not
`liquidui:cartridge_runtime_v1`; `.tsx` the reverse. All imports are extensionless, so
whichever won module resolution **silently lost a template**. Merged to one canonical
`registry.tsx` carrying both; `registry.ts` deleted.

## 3. EXP-003 — rediscovery-savings benchmark (CFS-008 §2)

`scripts/benchmark-rediscovery.mjs` + `foundation/experiments/exp-003-rediscovery-savings/README.md`.
Five fixed constitutional-design tasks, answered **cold vs initialized** with EXP-001's
18-invariant closure (same model, temperature 0); measures output tokens (rediscovery
cost), grounded-claim share + canon contradictions via an independent judge pass, and
distinct invariants cited. Results land as `results-<date>.json` + a paste-ready summary
table. Registered in `col_experiments`.

## Operator actions

Run the first EXP-003 pass (operator env — the sandbox has no outbound HTTPS):

```bash
cd /Users/hal1/CascadeProjects/AigentZBeta && git pull && \
node scripts/benchmark-rediscovery.mjs --dry-run && \
node scripts/benchmark-rediscovery.mjs
```

Then paste the printed summary table into the EXP-003 README's Results section and
commit the results JSON. No migrations, no seed changes for any of the three.
