# CFS-001 — The Invariant Primitive

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

Defines the atomic unit of Invariant Intelligence: its levels, schema, lifecycle, provenance, confidence, standing, validation, versioning, composition, and reasoning provenance.

---

## 1. The three levels

The invariant exists at three levels. Conflating them was the central design risk; this specification separates them permanently.

### Level 1 — Invariant
Atomic. Lives in the graph. Small.
A single statement in its simplest canonical form (e.g. *"Authority follows standing."*). Implemented as a **row**, not an iQube — thousands of invariants must be cheap to store, traverse, and reason over.

### Level 2 — Invariant Collection
A coherent set of related invariants. Still graph-native.
A named grouping (e.g. *"Delegation invariants"*) used for curation, retrieval, and composition. Implemented as a lightweight grouping entity over Level-1 rows.

### Level 3 — InvariantQube
A published, versioned, provenance-bearing **package of compressed expertise**. This is what becomes mintable.
An InvariantQube encapsulates a validated collection plus its subgraph, ontology references, evidence, and reasoning provenance — published through the Registry with full iQube trinity semantics (CFS-004). The iQube remains the constitutional publication mechanism; individual invariants stay lightweight.

## 2. Invariant schema (Level 1)

Proposed canonical row shape (final DDL in the Phase 1 migration):

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | primary key |
| `statement` | text | the simplest canonical form; one sentence |
| `namespace` | text | ontology namespace (CFS-002): `constitutional \| reasoning \| engineering \| experience \| capability` |
| `ontology_class_id` | uuid → `ontology_classes` | semantic classification |
| `status` | enum | lifecycle, §4 |
| `confidence` | numeric | §5 |
| `confidence_basis` | text | which verification tier produced the confidence |
| `standing_ref` | jsonb | discoverer/validator standing snapshot (T2-safe refs only) |
| `version` | int | monotonic |
| `supersedes_id` | uuid → self | supersession pointer |
| `provenance` | jsonb | discovery record: source programme, session, method |
| `reasoning_provenance` | jsonb | the reasoning act that produced it: inputs, method (llm/human/derivation), evidence refs |
| `creator_persona_id` | uuid | **T0 — server-internal only, never serialised** |
| `creator_alias_commitment` | text | T2 commitment for anything network/chain-bound |
| `dvn_receipt_id` | text | set when canonized/validated (anchored) |
| timestamps | | |

Identifier tiering follows the Identity & Access Spine: `creator_persona_id` is T0; only alias commitments appear in receipts or chain-bound payloads.

## 3. Invariant Context — the fourth foundational object

The same invariant can exist in multiple domains. *"Authority follows standing"* applies to constitutional governance, organizations, AI agents, and marketplaces. **The invariant doesn't change. Its context does.**

Invariant Context is therefore a first-class object, not a column:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `invariant_id` | uuid → `invariants` | |
| `domain` | text | e.g. `governance`, `organizations`, `agents`, `marketplaces` |
| `interpretation` | text | how the invariant reads in this domain |
| `applicability_conditions` | jsonb | when it binds in this domain |
| `retrieval_tags` | text[] | context-scoped retrieval vocabulary |

Contexts are the primary retrieval surface: queries resolve invariants **through** contexts, so retrieval is domain-aware while the canonical statement remains singular. Graph edges (CFS-003) may be context-scoped: an edge can hold in one domain and not another.

## 4. Lifecycle

```
draft → proposed → validated → canonical
                     │              │
                     ▼              ▼
                 rejected      deprecated / superseded
```

- **draft** — extracted or authored, unreviewed
- **proposed** — submitted to validation (Invariant Service, CFS-003a)
- **validated** — passed validation; usable by runtime with confidence attached
- **canonical** — ratified into the canon; DVN-anchored (`invariant_canonized` receipt); becomes constitutional memory
- **deprecated / superseded** — retired or replaced via `supersedes_id`; remains readable for audit (the Registry's supersession grammar, `mark_superseded_by`/`mark_supersedes`, applies)

The lifecycle grammar deliberately mirrors `services/registry/lifecycle.ts` (9-state internal / 5-state surface) so operators learn one state machine.

## 5. Confidence

Confidence adopts the platform's existing verification-weight ladder (`services/standing/standingScore.ts`):

| Basis | Weight |
|---|---|
| DOCUMENT_VERIFIED (evidence-backed) | 1.0 |
| PRINCIPAL_VERIFIED (human attested) | 0.85 |
| AGENT_VERIFIED (agent derived) | 0.6 |
| UNKNOWN | 0.3 |

Confidence is not static: the Knowledge Evolution stage of the operating model (CFS-006a §"Knowledge Evolution") adjusts confidence as observed consequences confirm or contradict the invariant. Contradiction edges (CFS-003) depress confidence; validated predictions raise it.

## 6. Standing

Discovery and validation of invariants are standing-bearing acts. The existing standing signal pipeline (`services/standing/standingSignalService.ts`, DVN-anchored via `standing_accrued`) gains invariant signal kinds. Standing calibrates confidence in the discoverer's future proposals — it never gates the truth of a statement (per the Standing Charter: standing is confidence in veracity, not status).

## 7. Validation

Validation is owned by the Invariant Service (CFS-003a). An invariant is validated by:
1. **Consistency** — no unresolved `contradicts` edge to a canonical invariant
2. **Groundedness** — reasoning provenance present and evidence refs resolvable
3. **Canonical form** — simplest expression; duplicates detected by comparison (CFS-003a §comparison) and merged, not multiplied
4. **Human ratification** for `canonical` status — via the existing canonization request queue pattern (`iqube_canonization_requests`), per Law XI: humans define semantics

## 8. Versioning & composition

Versioning is by supersession, never mutation of validated rows. Composition happens at Level 2 (collections) and Level 3 (InvariantQubes) and through graph `composes` edges — an invariant is never edited to "include" another.

## 9. Current substrate

Nothing in this spec exists yet as a table; everything it needs exists as precedent: score axes (`iqube_scores`), verification ladder (`standingScore.ts`), supersession (`lifecycle.ts`), canonization queue, DVN anchoring (`ANCHORABLE_ACTION_TYPES` — extended with `invariant_canonized`, `invariant_validated`, `invariant_superseded`, the pipeline's one permitted unilateral change), and the T0/T1/T2 identifier spine.
