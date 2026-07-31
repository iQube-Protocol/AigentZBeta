# Invariant Composition + Consequence Operating Model — Chrysalis Phases 2 & 3

**Date:** 2026-07-03
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Specs:** CFS-004 §3, CFS-005 (Phase 2); CFS-006a (Phase 3) — from `codexes/packs/agentiq/foundation/`
**Builds on:** Phase 1 substrate (`2026-07-03_invariant-substrate-phase-1.md`)

## Phase 2 — Composition & Publication (Levels 2 & 3)

Made the three-level invariant model real: individual invariants (Level 1, Phase 1) → **Invariant Collections** (Level 2) → **InvariantQube** (Level 3, published/mintable).

### Schema — `supabase/migrations/20260703210000_invariant_collections_and_qubes.sql`
- `invariant_collections` + `invariant_collection_members` — Level 2 grouping (may span namespaces)
- `invariant_qubes` — Level 3: composition manifest + `iqube_id` backlink + aggregate confidence/standing + status (draft/published/superseded). Mirrors `venture_qubes`.
- `invariant_qube_published` action type (CHECK recreated with full union)

### Service — `services/invariants/{collections,publish}.ts`
- Collections CRUD + membership (`services/invariants/collections.ts`)
- `composeManifest` — internal-edge subgraph, context union, **weakest-link aggregate confidence**, **mean aggregate standing**, **coherence gate** (rejects a bundle containing a `contradicts` edge between two members)
- `publishInvariantQube` — coherence gate → `createMetaQube` (DataQube) → `iqube_id_map` row (`source='triad_meta'`, `metadata.kind='invariant_bundle'`, the VentureQube precedent — no id-map migration) → persona ownership → DVN-anchored `invariant_qube_published` receipt → backlink. Staged registration per CFS-004 §3 Stage 1; promotion to a 7th primitive is a later canonization.

### Routes (spine-gated)
- `GET/POST /api/invariants/collections`, `GET/POST /api/invariants/collections/[id]`
- `GET/POST /api/registry/invariant-qube` (publish; ranked by standing), `GET /api/registry/invariant-qube/[id]`

## Phase 3 — Consequence Engineering Operating Model (CFS-006a)

"How constitutional intelligence actually executes." Shipped as a tested, runnable service consuming the invariant substrate; the flywheel closes.

### `services/consequence/`
- `pipeline.ts` — the canonical **13-stage pipeline** as single source of truth (Intent → Knowledge Curation → Knowledge Compression → Risk → Value → Capability → Consequence Forecasting → Planning → Execution → Observation → Standing → Registry Update → Knowledge Evolution), pre/post-approval split, and the **flywheel** invariant (`knowledge_evolution → knowledge_curation`).
- `stages.ts` — the new substrate-consuming stages:
  - `knowledgeCuration` — highest-standing validated/canonical invariants for a context + dependency closure → **KnowledgeQube**; coherence-checked
  - `forecastConsequences` — traverses `enables`/`constrains`/`contradicts` → **consequence graph**; a reachable contradiction or a canonical constraint sets `forcesEscalation` (CFS-006a §5 — informed guardian veto)
  - `assessRisk/ValueHeuristic` — v1 heuristics reusing the existing phase2 `RiskAssessment`/`ValueAssessment` interfaces (the canonical `assessRisk/assessValue` are throwing stubs; heuristic is the documented swap point)
- `operatingModel.ts` — the reference/synchronous runner: sequences pre-approval stages, computes the **disposition** (`deny` if incoherent · `escalate` if forecast forces it or risk ≥70 · `ask` if risk ≥40 or no knowledge · else `act`), stops at the Planning→Execution gate. `executeApproved` runs the post-approval arc and **closes the flywheel** — each grounding invariant gets `recordConsequence(confirmed|contradicted)`, updating confidence + Invariant Standing.

### Route — `POST /api/consequence/run` (admin, spine-gated)
Runs the pipeline for an `intentRef`; with `execute=true` on an executable disposition, runs the post-approval arc.

### Receipts + DVN
New action types `knowledge_curated` (local), `consequence_forecast_recorded` + `knowledge_evolved` (DVN-anchored — the flywheel's constitutional arc). Migration `20260703220000_consequence_receipt_types.sql`.

## Tests
- `tests/invariant-substrate.test.ts` — 17 (Phase 1 + Phase 2 aggregation/coherence)
- `tests/consequence-pipeline.test.ts` — 8 (pipeline SoT integrity, pre/post split, flywheel, risk/value heuristics)
- **25 passing.** Stage functions that hit the DB (curation/forecasting/publish) are verified in the operator environment.

## Deferred (explicit, not silent)
- **Phase 3b — chain-template deployment.** CFS-006a §4 commits to shipping the pipeline as a `consequence-operating-model.v1` template on the `intent_chains` dispatcher (rpc steps + new orchestration event types). Deferred because it touches the sensitive dispatcher/advancer (charging, cron, receipts) and can only be verified against a live environment. The operating model runs today via the service + `/api/consequence/run`; the chain template is the async/charged production vector.
- **`value` score axis on `iqube_scores`** (CFS-004 §2.2) — deferred to keep Phase 2 focused on the composition keystone; the InvariantQube already carries `aggregate_confidence`/`aggregate_standing`.
- **Capability Composition** — the runner records `capabilityQubeId=null`; ClusterQube assembly over ToolQubes/AigentQubes is the wiring point.
- **Knowledge Compression net-new discovery** — v1 treats curated invariants as the compressed set; discovering new invariants from raw sources is `discoverInvariant()`, wired when the pipeline curates non-invariant sources.

## Operator actions
1. Apply migrations in order: `20260703210000_invariant_collections_and_qubes.sql`, then `20260703220000_consequence_receipt_types.sql`.
2. (After Phase 1 seed) Try the flywheel end to end:
   - Create a collection: `POST /api/invariants/collections` `{ "name": "...", "memberInvariantIds": [...] }`
   - Publish: `POST /api/registry/invariant-qube` `{ "collectionId": "..." }`
   - Run: `POST /api/consequence/run` `{ "intentRef": "test-intent", "contextDomain": "governance" }`
   All via personaFetch (admin persona).
