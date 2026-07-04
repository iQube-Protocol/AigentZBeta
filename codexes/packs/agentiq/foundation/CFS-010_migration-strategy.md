# CFS-010 — Migration Strategy

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

This document embodies the philosophy. Rather than **Old System → New System**, we define:

```
Existing Architecture
        ↓
Invariant Extraction
        ↓
Semantic Evolution
        ↓
Progressive Migration
        ↓
Runtime Adoption
```

No rewrites. Only evolution. Exactly as science evolves.

---

## 1. The stages, applied to this bundle

### Stage 1 — Existing Architecture (done: the substrate maps)
The current system was mapped before anything was designed: the canonical registry plane, the trinity, the score model, the intent/receipt/standing spine, the chain engine, the fragmented graph structures. The terminology bridge (CFS-000 §7) is this stage's artifact — Law IV applied to the migration itself.

### Stage 2 — Invariant Extraction (Phase 1)
Extract what is already true and working into the invariant substrate:
- Additive migration: `invariants`, `invariant_contexts`, `invariant_edges`, `ontology_classes` — **no existing table altered**
- Seed from Appendix A (`canonical-invariants.seed.json` + ingest script)
- Project existing fragmented edges read-only into the unified graph (CFS-003 §6)
- Invariant Service v1 (`services/invariants/`) + spine-gated APIs
- DVN action types added (the pipeline's one permitted unilateral change)

### Stage 3 — Semantic Evolution (Phase 2)
Evolve meanings without breaking carriers:
- `invariant` extension block on the canonical record; `value` score axis + deriver
- InvariantQube publishes as `DataQube` + `source='invariant_bundle'` (Stage-1 registration, CFS-004 §3)
- Registry gains ontology navigation + graph traversal + context-aware similarity
- Canonization request filed for the seventh primitive — ratification gates the CHECK migration

### Stage 4 — Progressive Migration (Phase 3)
The operating model ships as the `consequence-operating-model.v1` chain template (CFS-006a §4):
- New stages (Knowledge Curation, Knowledge Compression, Consequence Forecasting, Knowledge Evolution) land as chain steps calling the Invariant Service
- Existing stages (Intent, Planning, Execution, Observation, Standing, Registry Update) are **adopted in place** — the template calls the same services the platform already runs
- Existing intents continue on their current paths; the template is opt-in per NBE/activation until proven, then becomes the default routing

### Stage 5 — Runtime Adoption (Phase 4)
- Grounding contract extension; invariant slices in specialist packets; guardian constraint checks (CFS-006)
- Renderer abstraction retrofitted over CopilotKit + liquid templates (CFS-007)
- Knowledge initialization at session start
- CFS-008 measurement instrumentation rides the existing receipt spine

## 2. Sequencing & dependencies

```
Phase 0 (this bundle)
   ↓
Phase 1 — Invariant Trinity + Service          [Stage 2]
   ↓
Phase 2 — iQube/Registry evolution  ∥  Phase 3 — Operating model   [Stages 3–4, parallel]
   ↓
Phase 4 — Runtime + rendering adoption          [Stage 5]
   ↓
Phase 5 — CFS-008 paper · constitution ratification · this document updated from evidence
```

## 3. Invariants of the migration itself

- **Additive-only schema changes** until a canonization ratifies otherwise
- **Operator approval gates**: the primitive-type CHECK change, DVN payload/state-machine changes (never — only action-type additions), spine files, canonical promotions
- **Identifier tiering everywhere**: T0 never serialised; T2 commitments on anything network/chain-bound
- **Every phase leaves the platform shippable** — no phase ends mid-air; each lands as deployable, receipted increments
- **Rollback by supersession**: nothing deleted; anything mis-evolved is superseded with provenance intact

## 4. Completion criterion

The migration is complete when this document can be rewritten as a *record* rather than a plan — CFS-010 v1.0 will describe what the evolution actually did, with receipts. That rewrite is itself the final act of Law IV.
