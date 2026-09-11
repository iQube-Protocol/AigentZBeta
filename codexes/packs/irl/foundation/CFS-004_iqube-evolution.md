# CFS-004 — iQube Evolution

**Chrysalis Foundation Specification · v0.1 · Status: draft**
Constitutional anchor: `codexes/packs/polity-core/constitutional-records/invariant-intelligence.md`

Transform the iQube into the canonical encapsulation of compressed expertise — by extension of the canonical registry plane, not replacement.

---

## 1. What is preserved (Law I)

The trinity and its plane are untouched:

- **metaQube / blakQube / tokenQube** (`iq_meta_qubes`, `iq_blak_qubes`, `iq_token_qubes`; `server/services/iqRegistryService.ts`)
- The canonical spine `iqube_id_map` (six primitives, CHECK-constrained), extension blocks (`tool`/`aigent`/`cluster`), 9-state lifecycle, mint saga, ownership ledger, projections (admin/cartridge/public)
- The score model (`iqube_scores`: sensitivity/accuracy/verifiability/risk → derived reliability/trust, operator overrides sacred)

## 2. The invariant-aware architecture (what is added)

### 2.1 New extension block

`CanonicalIQubeInternalRecord` gains an optional `invariant` block — the same additive pattern as `tool`/`aigent`/`cluster`:

```
invariant?: {
  invariant_refs: string[]        // Level-1 members (by id)
  collection_refs: string[]       // Level-2 collections included
  ontology_refs: string[]         // ontology classes covered
  context_refs: string[]          // domains of applicability
  graph_manifest_ref: string      // the composition manifest (CFS-003 §5)
  evidence_refs: string[]         // supporting evidence (receipts, documents, facts)
  intent_ref?: string             // the IntentQube that commissioned this expertise
  reasoning_provenance: {...}     // the compressed reasoning trail
}
```

### 2.2 Evolved scoring surface

The spec's dimensions map onto the existing model rather than replacing it:

| Dimension | Disposition |
|---|---|
| **Risk** | exists — `iqube_scores.risk` axis |
| **Value** | **new axis** on `iqube_scores`, derived by wiring the existing `services/registry/phase2/value` engine into `scoreBackfill/` (strategy `invariant_qube_v1`) |
| **Standing** | reference, not axis — snapshot of discoverer/validator standing (`standing_ref`), never a mutable copy |
| **Capability** | expressed via `composes`/`enables` edges + the capability ontology namespace |
| **Reasoning / Evidence / Intent** | the extension-block refs above |

### 2.3 metaQube / blakQube / tokenQube semantics for compressed expertise

- **metaQube** — public statement of what expertise this package holds: ontology classes, contexts, aggregate confidence, member count. Discoverable without disclosure.
- **blakQube** — the confidential payload where warranted: full reasoning transcripts, proprietary evidence, un-redacted provenance. Compressed expertise can be sovereign property; blakQube compartmentalisation is what makes expertise **ownable** without being public.
- **tokenQube** — access/monetisation control: who may load this expertise into their runtime. Minting an InvariantQube makes compressed expertise a transactable asset with the existing mint saga, chain anchoring, and ownership ledger.

## 3. The InvariantQube (Level 3)

Per CFS-001 §1: individual invariants are rows; **the InvariantQube is the published, versioned, provenance-bearing package** — the constitutional publication mechanism. It is what becomes mintable.

**Staged promotion (Law I + CFS-010):**

1. **Stage 1 — now.** InvariantQubes register into `iqube_id_map` as `primitive_type='DataQube'` with a `source='invariant_bundle'` mapping — exactly the precedent VentureQube set (registered as ClusterQube while its shape stabilised). Chain-template precedent also applies (`source='code:chainTemplate'` synthetic rows).
2. **Stage 2 — after the shape stabilises.** File a canonization request to promote `InvariantQube` to a first-class seventh primitive; the CHECK-constraint migration ships only after operator ratification. `legacy_primitive_type` preserves the Stage-1 classification, exactly as the v1.1 primitive collapse did.

KnowledgeQube and CapabilityQube (CFS-006a products) follow the same staging: CapabilityQube as a ClusterQube specialization (the VentureQube precedent, reusing `member_iqubes[]`/`dependency_graph`); KnowledgeQube starting on the lean IntentQube storage pattern, promoted only if it proves distinct.

## 4. Versioning

InvariantQube versions follow registry supersession (`new_version_pending`, `mark_superseded_by`/`mark_supersedes`) — a new version is a new composition manifest over evolved invariants, never an edit of a published package. `content_qube_versions` provides the snapshot-ledger precedent if per-version payload snapshots are needed.

## 5. Current substrate index

`types/registry-canonical.ts` (internal record + blocks + saga states), `types/iqube/legibility.ts` (primitives + agent card), `supabase/migrations/20260530000000_registry_canonical_plane_v1_0_stage_1.sql`, `20260531000000_iqube_scores.sql`, `services/registry/{resolver,persistence,mintSaga,lifecycle}.ts`, adapters + scoreBackfill derivers, `app/api/registry/iqube/*`.
