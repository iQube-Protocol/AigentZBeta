# CFS-010 — Migration Record

**Chrysalis Foundation Specification · v1.0 · Status: record**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

This document was authored as a *plan* (v0.1, 2026-07-03) and is now rewritten as a
*record* — its own completion criterion (§4 of the plan): "the migration is complete when
this document can be rewritten as a record rather than a plan." This rewrite is the final
act of Law IV. The philosophy held end-to-end:

```
Existing Architecture → Invariant Extraction → Semantic Evolution
        → Progressive Migration → Runtime Adoption
```

No rewrites. Only evolution. Every stage landed additively, every increment shipped
deployable, and every change is receipted below by its commits on `dev`.

---

## 1. What each stage actually did

### Stage 1 — Existing Architecture (mapped, 2026-07-03)
The substrate was mapped before anything was designed: the canonical registry plane, the
trinity, the score model, the intent/receipt/standing spine, the chain engine, the
fragmented graph structures. The terminology bridge (CFS-000 §7) is this stage's artifact.
No code changed in this stage — exactly as specified.

### Stage 2 — Invariant Extraction (Phase 1 · shipped 2026-07-03)
- Additive migration `20260703200000_invariant_substrate.sql`: `invariants`,
  `invariant_contexts`, `invariant_edges`, `ontology_classes` — **no existing table
  altered**. Applied by the operator to Supabase.
- Invariant Service v1 (`services/invariants/` — store, graph, comparison, lifecycle) +
  spine-gated APIs (`/api/invariants`, `/api/invariants/graph`, `/api/ontology`).
- Appendix A seeded via `scripts/ingest-canonical-invariants.mjs` (idempotent on
  seed_id) — ultimately 83 invariants across what became 7 namespaces.
- DVN action types added — the pipeline's one permitted unilateral change.
- **Receipts:** `a32c682a` (substrate + service + APIs + ingest), `a1a42120` (record).

### Stage 3 — Semantic Evolution (Phase 2 · shipped 2026-07-03)
- Level 2/3 of the three-level model: invariant collections + InvariantQube publication
  (`20260703210000_invariant_collections_and_qubes.sql`; `services/invariants/collections.ts`,
  `publish.ts` — manifest composition, weakest-link aggregate confidence, aggregate
  standing, coherence check).
- InvariantQube publishes as `DataQube` + `source='invariant_bundle'` — the Stage-1
  registration posture (CFS-004 §3). **The seventh-primitive canonization remains an open
  constitutional gate** (see §3).
- Registry evolution: ontology navigation, graph traversal, context filtering surfaced
  through the service APIs; the browsing UI followed in Stage 5 (`802b6906`, `a180ab59`,
  `5132d14c` — canonical home: iQube Registry cartridge, Browse group).
- **Receipts:** `e9c64f2a` (collections + publication), `f3969d98` (record).

### Stage 4 — Progressive Migration (Phase 3 + 3b · shipped 2026-07-03)
- The operating model landed as code (`services/consequence/` — the 13-stage pipeline,
  `runConsequencePipeline`, `executeApproved`) with the four new stages (Knowledge
  Curation, Knowledge Compression, Consequence Forecasting, Knowledge Evolution) calling
  the Invariant Service, and the existing stages adopted in place.
- Shipped as the `consequence-operating-model.v1` chain template on the intent_chains
  dispatcher (CFS-006a §4) — opt-in per NBE/activation, exactly as planned
  (`20260703220000_consequence_receipt_types.sql` added the receipt action types).
- **Receipts:** `f6bfcd6f` (operating model), `cd3cdb71` (chain template),
  `0d44b4d0` (record).

### Stage 5 — Runtime Adoption (Phase 4 · shipped 2026-07-04)
- Grounding contract extension: `GROUNDING_MANDATE` grew the invariant-citation line;
  `INVARIANT_GROUNDING_CLAUSE` added for slice-carrying surfaces
  (`services/orchestration/groundingContract.ts`).
- Invariant slices in specialist packets: `services/invariants/grounding.ts`
  (`buildInvariantSlice` — context-filtered, standing-primary per Law XII, T1-safe) wired
  through `SpecialistContext.invariantSlice` and the ask-agent route. Citations travel by
  seedId — the router's UUID-stripping redaction net is preserved.
- Guardian constraint checks: `forecastConsequences` names constitutional constraints
  distinctly (`constitutionalConstraint` + ids) — the veto is invariant-informed AND
  constitutionally legible, without widening or narrowing what escalates.
- The flywheel's return arc closed on both Law XII axes: Standing via
  `recordConsequence` (Phase 3) and Reach via `citeInvariants` → `recordUsage` in
  `executeApproved` (Phase 4 — previously dead code; the runtime spent knowledge without
  recording adoption).
- **Receipts:** `e8372a57` (runtime adoption), plus the rendering surfaces
  `8c770331`/`128b9c1d` (invariant-grounded video pipeline + composition laws + coherence
  engine — CFS-011/012/013/014).

### Phase 5 — Measurement + this record (shipped 2026-07-04)
- CFS-008 §2 instrumentation rides the receipt spine: `invariants_used` on
  `activity_receipts` (`20260704100000_activity_receipts_invariants_used.sql`, GIN-indexed),
  threaded through `activityReceiptService` (graceful pre-migration degradation) and
  populated at every grounded act — consequence stage receipts, knowledge-evolution
  receipts, and specialist consultations.
- The measurement readout: `computeMeasurementRollup` +
  `GET /api/invariants/measurement` — per-namespace reuse counts (adoption axis) and
  consequence accuracy (validation axis) reported as **separate** axes (Law XII), with
  the receipt-spine grounded-execution count reported as *null* until the column is
  applied — unmeasured, never fake-zero.
- This rewrite.

## 2. Constitutional evolution ratified along the way

The migration produced more constitution than it consumed — the flywheel working on its
own governing documents:

| Law / spec | What it ratified | Receipt |
|---|---|---|
| Law XII (+ CFS-009 amendment) | Truth, Standing and Reach — orthogonal axes; the standing/reach split in code | `a6ce101a` |
| Law XIII | Individualization — continuity without identifiability; ZK layer premise | `43d0aa64` |
| CFS-011 | Style invariants (namespace 6) | `8c770331` |
| CFS-012 | Narrative invariants (namespace 7) | `8c770331` |
| CFS-013 | Composition laws (per-namespace, compile-time exhaustive) | `128b9c1d` |
| CFS-014 / Law XIV | Constitutional Coherence Engine (fail-closed CCS) | `128b9c1d` |
| EXP-001 / EXP-002 | Flywheel experiments — living KnowledgeQube + invariant-carried video | `dfbd730f` |

## 3. Invariants of the migration — held, with two open gates

- **Additive-only schema changes** — held. Every migration added tables/columns; nothing
  existing was altered or dropped.
- **Operator approval gates** — held. DVN saw only action-type additions; spine files
  untouched; the primitive-type CHECK change was never made because…
- **…the seventh-primitive canonization is still an open constitutional gate.**
  InvariantQubes register as `DataQube` + `source='invariant_bundle'` until ratification.
  The `value` score axis + deriver is parked with it.
- **Identifier tiering** — held. T0 never serialised (canary tests enforce);
  T2 commitments on chain-bound refs; slices/rollups are T1 projections.
- **Every phase left the platform shippable** — held; each phase landed as deployed,
  receipted increments on `dev`.
- **Rollback by supersession** — the mechanism exists (`supersedes_id`, quarantine on
  contradiction) and nothing has needed deletion.

## 4. What completion means — and what keeps accruing

The *migration* is complete: the substrate exists, the semantics evolved, the operating
model runs, the runtime grounds on and returns consequence to the canon, and the
measurement instrumentation is live. The *flywheel* is not "complete" — by design it
never is. Production evidence (reuse counts, consequence accuracy, rediscovery savings)
accrues through the instrumentation shipped in Phase 5 and feeds the CFS-008 paper, whose
skeleton stands ready in CFS-008 §6.

v0.1 of this document ended: "That rewrite is itself the final act of Law IV." It was.
