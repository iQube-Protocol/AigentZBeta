# CFS-041 / PRD-CFO-001 — The Constitutional Field Observatory (CFO)

**Status:** Architectural Foundation — **RATIFIED 2026-07-28** by operator act `ACT-IRE-FAMILY-2026-07-28`, decision id `CFS-041`.

> **What was ratified, and against which bytes.** The operator approved **one act covering CFS-037, CFS-038, CFS-039, CFS-040 and CFS-041**, each document enumerated independently — *"One act may contain five document commitments, but each document must remain independently attributable and recoverable."* **No aggregate family hash exists**, deliberately: a family hash would make one document unrecoverable without the other four.
>
> This document was frozen at `sha256:cfb1726151d7b6d3bd71259c04ff61cb167dd633de9c83fa9c2d84200fab25a5` — its bytes **after** the IRE→IPE consistency corrections required by the same disposition (*"Before signing, update any text that is already contradicted by the now-landed IRE→IPE binding"*) and **before** this status block was rewritten to record the act. A sha256 cannot commit to bytes that contain it, so the frozen hash is necessarily the pre-record hash; the post-record (`as-recorded`) hash of every one of the five is enumerated in `codexes/packs/polity-core/items/AMENDMENT_RECORDS.md`, which is also the ledger row for this act.
>
> **The 2026-07-17 attestations are NOT the basis of this act.** Five contemporaneous records attest an operator ratification that day (`be5942ae4`; `2026-07-17_ire-prd-family-phase0-builds.md`: *"All four ratified. Build all 4"*; `CHRYSALIS_WORKSTREAM_TRACKER` row 99), and **every one is an agent transcription**, which Law XI does not permit an agent to promote on. What unblocked this is the operator supplying the act directly on 2026-07-28. The transcripts remain corroboration of intent and are not the authority.

**Classification:** Constitutional Observation surface (makes the field + coordinates visible).
**Designation:** IRL ratified-spec filing of **PRD-CFO-001** (the PRD family, §9 of CFS-037). **Extends** the existing Constitutional Observatory (CFS-035 amendment) — it does not replace it.
**Dependencies:** CFS-035/037/038/040 (the field, coordinates, resolution, knowledge), the existing Observatory (`app/api/invariants/observatory/route.ts`, `components/registry/FieldView.tsx`).

---

## 0. Observation, extended to coordinates

The existing Observatory (CFS-035) makes the invariant substrate visible — Node · Field · Graph · Projection · Health, the iQube Registry's third top-level view. The CFO **extends** it to the new objects the IRE/CCR/KRE produce: **constitutional coordinates**, **resolved fields**, and **constitutional-space navigation**. Nothing existing is renamed or removed; the CFO is additive perspectives + telemetry.

Naming note (CFS-037 §6): "Constitutional Field" already names this visualization surface. The CFO keeps that name for the **global** field view and adds a **Resolved-Field** view for per-intent regions — the register distinction, made visible.

## 1. New perspectives (additive to the existing five)

- **Coordinate Topography** — the field rendered in constitutional space: invariants/iQubes/agents as points/regions along the CCR basis (structural/constitutional/operational). The MetaVitruvian / Bearing Instrument representation language (already canonical) is the natural renderer — coordinate axes map to its sectors.
- **Resolved-Field view** — for a given intent, the region the IRE resolved: the qualified intent, the resolved invariants, their coordinates, the operational estimates (coverage/reuse/ttv), and the KRE's reuse/compose/create decision. The IRE's Phase-0 trace line (`describeResolvedField`) is the seed of this view.
- **Constitutional proximity / navigation** — "what occupies this region?" — iQubes, workflows, agent-teams near a point in constitutional space (the KRE's retrieval signal, made visible). Field navigation, not keyword search.
- **Field dynamics** — movement through constitutional space over time (the CFS-019 Field Theory measurements: field strength, interference, coherence) once the CCR gives them a coordinate system.

## 2. Constitutional Observability metrics (extended)

The existing Health perspective already derives metrics from collected signals (never new instrumentation). The CFO adds the CFS-037 §11 success metrics as **observed** telemetry:

- **Field Resolution Coverage** — intents producing a complete resolved field without manual grounding.
- **Knowledge Reuse Rate** — resolved fields satisfied by existing iQubes vs newly realised (the KRE loop's headline number).
- **Reasoning Reduction** — prompt-size / LLM-call savings from upstream constitutional computation.
- **Projection Consistency** — downstream systems agreeing when consuming the same field (the IPE's Evolution-face signal).
- **Constitutional Explainability** — decisions traceable through invariant receipts to field coordinates.

All **derived** from receipts + resolution traces + shadow observations — the Observatory-reads-the-engine-never-re-instruments discipline (CFS-035), carried forward.

## 3. Code-truth — what exists vs new

| CFO piece | Verdict | Existing | Relationship |
|---|---|---|---|
| Observatory API + Field view | **Exists** | `/api/invariants/observatory`, `FieldView.tsx` (5 perspectives) | Extend — add the coordinate/resolved-field/proximity perspectives |
| Representation renderer | **Exists** | MetaVitruvian / Bearing Instrument, `types/representation.ts` sectors | Reuse — coordinate axes → representation sectors |
| Persisted observations | **Exists** | `invariant_shadow_observations` (CFS-035) | Extend — persist resolved-field + coordinate observations |
| Coordinate topology data | **ABSENT** | — | New (depends on CCR, CFS-038) |
| Resolved-field telemetry | **Partial** | the IRE trace line (Phase 0) | Extend — persist + render the resolved field |

## 4. Build plan (ratify-before-build)

- **Phase 0:** the Resolved-Field view — surface `resolveConstitutionalField`'s output (already produced in the Horizen pipeline's step-1 trace) as an Observatory panel. Read-only, additive.
- **Phase 1:** Coordinate Topography — render the CCR basis (once ratified) using the representation renderer.
- **Phase 2:** constitutional-proximity navigation (consume the KRE signal).
- **Phase 3:** field-dynamics over persisted resolved-field observations (the Field Theory measurements' first visualization).

## 5. Honest limits

- **Coordinate/topology views depend on the CCR** (CFS-038) — until a basis is ratified, the CFO shows the Resolved-Field view + existing perspectives only.
- **Field-dynamics metrics are proposed, not computed** — field strength / interference / coherence have no operationalised metric yet (CFS-019).
- **Additive only** — no existing Observatory perspective changes; the "Constitutional Field" visualization name is preserved (register distinction, §0).
- This spec seeds no invariant and gates no Chrysalis deliverable.

## Ratification record
- [x] **RATIFIED 2026-07-28** — PRD-CFO-001 filing, last of the CFS-037 PRD family. Ratified in full — the numbered items below are what the operator approved: (1) the additive perspectives (§1); (2) the extended Constitutional Observability metrics as derived telemetry (§2); (3) the Phase-0 Resolved-Field view (§4).

  Authority: operator act `ACT-IRE-FAMILY-2026-07-28`, decision id `CFS-041`, authority basis **Law XI — amending canon is an operator act**. Frozen content hash `sha256:cfb1726151d7b6d3bd71259c04ff61cb167dd633de9c83fa9c2d84200fab25a5` (bytes after the IRE→IPE consistency corrections, before this record was written). Ledger row: `codexes/packs/polity-core/items/AMENDMENT_RECORDS.md`. The 2026-07-17 agent transcriptions are corroboration of intent, never the authority (Law XI).

- [ ] **DVN anchoring outstanding** — the act is recorded through `POST /api/governance/ratify`, which writes the `governance_ratifications` row, invokes `createGovernanceReceipt` and enters the DVN pipeline. Until an operator runs it, this document's ratification exists in the repo ledger and not yet on chain.
