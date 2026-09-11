# Invariant Substrate — Chrysalis Foundation Phase 1

**Date:** 2026-07-03
**Session branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Specs implemented:** CFS-001, CFS-002, CFS-003, CFS-003a (v1) — from `codexes/packs/agentiq/foundation/`
**Constitutional anchor:** `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

Phase 1 of the Chrysalis Foundation migration strategy (CFS-010 Stage 2 — Invariant Extraction): the invariant substrate lands as additive schema + the Invariant Service + spine-gated APIs + the Appendix A seed pipeline. No existing table altered except the `activity_receipts` action-type CHECK (recreated, see below).

## What shipped

### Schema — `supabase/migrations/20260703200000_invariant_substrate.sql`
- `ontology_classes` — CFS-002 hierarchy (5 namespaces, self-referential, semantic types)
- `invariants` — CFS-001 Level-1 rows: lifecycle (draft→proposed→validated→canonical / rejected / deprecated / superseded), confidence + basis ladder, **Invariant Standing** (0–100 + accumulators: times_validated / times_contradicted / times_referenced / times_used), supersession, provenance + reasoning provenance, `creator_persona_id` (T0, never serialised) + `creator_alias_commitment` (T2), `seed_id` for idempotent ingest
- `invariant_contexts` — CFS-001 §3, the fourth foundational object; unique (invariant, domain); retrieval tags (GIN)
- `invariant_edges` — CFS-003, twelve edge types CHECK-constrained, weighted, optionally context-scoped, partial-unique on (from,to,type[,context])
- RLS service-role on all four tables (registry-plane pattern)
- `activity_receipts_action_type_check` recreated with the invariant lifecycle types **and restoring four types the TS union has but `20260624200000` dropped** (`operator_action_logged`, `standing_document_added`, `plan_purchased`, `plan_renewed`) — inserts of those types have been failing the constraint since that migration; this fixes it as a side effect

### The Invariant Service — `services/invariants/` (CFS-003a v1)
- `store.ts` — the ONLY module touching the tables; row→record mappers are the T0 enforcement point
- `graph.ts` — BFS traversal (depth-capped, context-filtered), `wouldCreateCycle` guard for depends_on/derives_from/supersedes, `reasoningPath` (explainability), `dependencyClosure` (knowledge initialization)
- `comparison.ts` — normalized-form + token-Jaccard duplicate detection (v1; embeddings can replace internals without contract change)
- `lifecycle.ts` — discovery (canonical-form + duplicate gate + receipt), validation gate (consistency/groundedness/form), canonization (admin ratification, DVN-anchored receipt), evolution (`recordConsequence` confidence + accumulators), conflict quarantine (contradicts-canonical → challenger back to proposed + `[INVARIANT CONFLICT]` escalation log), merging (edge redirect + context union + supersession), **`computeStandingScore`** (saturating growth, contradiction penalty)
- `index.ts` — canonical export surface; spine-discipline note (extend by composition, no parallel resolvers)

### API surface (spine-gated; clients must use `personaFetch`)
- `GET/POST /api/invariants` — list/filter (any persona) / discover draft (admin)
- `GET /api/invariants/graph` — traversal + `?path=reasoning|dependencies` presets
- `POST /api/invariants/[id]/advance` — propose/validate/canonize/reject/deprecate (admin; Law XI)
- `GET/POST /api/ontology` — class tree / class upsert (admin)

### Receipts + DVN (the one permitted DVN change: action-type additions)
- `ActivityActionType` union + DB CHECK gain `invariant_discovered`, `invariant_validated`, `invariant_canonized`, `invariant_superseded`
- `ANCHORABLE_ACTION_TYPES` gains validated/canonized/superseded (discovered stays local — high volume, pre-validation)

### Seed pipeline
- `scripts/ingest-canonical-invariants.mjs` — idempotent (upsert on `seed_id`; preserves operator-advanced status), seeds root ontology classes + 59 invariants + contexts from `codexes/packs/agentiq/foundation/canonical-invariants.seed.json`; `--dry-run` supported

### Tests
- `tests/invariant-substrate.test.ts` — 12 canaries: T0 non-serialization (mirrors the access-spine canary pattern), the twelve edge types, acyclic set, confidence ladder, canonicalization, comparison, standing formula. **All passing.**

## Foundation bundle amendments (same session)
- **CFS-000a — The Invariant Manifesto** (new, one page: five statements + the method sentence + the Three Orders)
- **CFS-001 §6.2 — Invariant Standing**: invariants themselves accrue Standing (constitutional capital: reuse, validation, foundational weight); the Registry becomes self-organizing — constitutional peer review
- **The Three Orders** elevated to canonical principle in `foundation/constitutional-record.md`: Polity/Constitutional Order/Why → AgentiQ/Computational Order/How → Chrysalis/Evolutionary Order/How It Evolves
- Appendix A + seed JSON: five additions (55–59), including the manifesto statements and "Invariants themselves accrue Standing."

## Operator actions required

1. **Apply the migration** in the Supabase SQL editor — paste the contents of `supabase/migrations/20260703200000_invariant_substrate.sql` (single copyable block; it is self-contained and idempotent-guarded with IF NOT EXISTS).
2. **Plant the seed crystal** (network-enabled machine, not the sandbox):
   ```bash
   git pull && node scripts/ingest-canonical-invariants.mjs --dry-run && node scripts/ingest-canonical-invariants.mjs
   ```
3. Verify: `GET /api/invariants?namespace=constitutional` (via personaFetch/devtools token snippet) should return the seeded constitutional invariants ordered by standing.

## What Phase 2/3 build on this
- iQube `invariant` extension block + `value` score axis (CFS-004)
- Registry ontology navigation + unified graph projection (CFS-005)
- `consequence-operating-model.v1` intent chain template (CFS-006a)
- Runtime grounding slices via `recordUsage` → standing accrual from real citations (CFS-006)
