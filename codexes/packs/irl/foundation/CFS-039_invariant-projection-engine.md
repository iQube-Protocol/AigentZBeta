# CFS-039 / PRD-IPE-001 — The Invariant Projection Engine (IPE)

**Status:** Architectural Foundation — **RATIFIED 2026-07-28** by operator act `ACT-IRE-FAMILY-2026-07-28`, decision id `CFS-039`.

> **What was ratified, and against which bytes.** The operator approved **one act covering CFS-037, CFS-038, CFS-039, CFS-040 and CFS-041**, each document enumerated independently — *"One act may contain five document commitments, but each document must remain independently attributable and recoverable."* **No aggregate family hash exists**, deliberately: a family hash would make one document unrecoverable without the other four.
>
> This document was frozen at `sha256:682fddeaef3de8e1c04108e367174600431ba35d010432cad87984c4d7904294` — its bytes **after** the IRE→IPE consistency corrections required by the same disposition (*"Before signing, update any text that is already contradicted by the now-landed IRE→IPE binding"*) and **before** this status block was rewritten to record the act. A sha256 cannot commit to bytes that contain it, so the frozen hash is necessarily the pre-record hash; the post-record (`as-recorded`) hash of every one of the five is enumerated in `codexes/packs/polity-core/items/AMENDMENT_RECORDS.md`, which is also the ledger row for this act.
>
> **The 2026-07-17 attestations are NOT the basis of this act.** Five contemporaneous records attest an operator ratification that day (`be5942ae4`; `2026-07-17_ire-prd-family-phase0-builds.md`: *"All four ratified. Build all 4"*; `CHRYSALIS_WORKSTREAM_TRACKER` row 99), and **every one is an agent transcription**, which Law XI does not permit an agent to promote on. What unblocked this is the operator supplying the act directly on 2026-07-28. The transcripts remain corroboration of intent and are not the authority.

**Classification:** Constitutional Runtime Primitive (the projector).
**Designation:** IRL ratified-spec filing of **PRD-IPE-001** (the PRD family, §9 of CFS-037). This spec **renames and re-scopes CFS-035** — it does not replace it; CFS-035's content (the governing law, the four faces, the node schema, the Observatory) stands, now under the IPE identity.
**Dependencies:** CFS-035 (the engine being renamed), CFS-037 (IRE — produces the field the IPE consumes), CFS-038 (CCR — the coordinate basis the IPE projects against).

---

## 0. The separation this completes

CFS-037 split the overloaded "engine" into resolution and projection. The **IRE constructs** the Resolved Constitutional Field; the **IPE projects** it into platform behaviour — ranking, routing, UX, governance, agent assembly, policy, recommendations. This spec makes the projection half explicit: the IPE **never resolves** invariants; it always consumes a field the IRE produced.

CFS-035 already *is* the IPE in all but name — the four faces (Reasoning · Constitutional Projection · Experience · Evolution), the `FieldSnapshot`, the decision nodes, the shadow loop, the Observatory. This spec renames it and upgrades what it consumes.

## 1. The rename — scope + discipline

"Invariant Engine" → **Invariant Projection Engine (IPE)**. Code-truth (2026-07-17 inventory): **120 references across 47 files**, but **low code risk** — no exported symbol is literally `InvariantEngine`; the load-bearing identifiers are `FieldSnapshot` / `computeFieldSnapshot` / `groundReasoning` / the node registry, which **keep their names**. The rename is overwhelmingly **doc + comment**, plus:

> **Correction, 2026-07-27 (`f7ab22432`) — the identifiers kept their names but not their module.** The rename inventory above was taken before the §3 contract was enforced in code. `FieldSnapshot`, `computeFieldSnapshot`, `groundReasoning` and `getCachedFieldSnapshot` all lived in `services/invariants/engine.ts` — the module this spec designates the IPE — so the projector constructed the very field it is forbidden to construct. Field construction now lives in `services/invariants/grounding.ts` (the substrate reader), composed upward by `services/invariants/resolution.ts` (the IRE); `engine.ts` imports `FieldSnapshot` as a **type only**. No identifier was renamed. §2 and §3 below are amended accordingly.

- `codexes/packs/irl/foundation/CFS-035_the-invariant-engine.md` — the canonical doc (already carries the rename pointer, 2026-07-17).
- Comments in `services/invariants/engine.ts` (12), `experience.ts`, the node files, the tests.
- Seed/appendix text (`canonical-invariants.seed.json` 14, `appendix-a` 6) — **highest-churn; touch last, carefully** (seed edits are money-adjacent to ingestion — CS-001 discipline).

**Rename is its own incremental change**, staged so the shipped CFS-035 surface (Observatory, flip, nodes) never destabilises: (a) docs + this spec first; (b) code comments; (c) seed/appendix text last, in one reviewed pass. No behaviour changes — identifiers stay, only prose + the concept name move.

## 2. The upgrade — projecting a Resolved Field (not a bare snapshot)

Today the IPE's faces consume a `FieldSnapshot` (`{context, slice, citedIds}`). CFS-037's IRE produces a richer **Resolved Constitutional Field** (`+ resolvedIntent, + coordinates, + operational`). The IPE upgrade: its projectors read the **coordinates**, not just the slice.

- **Constitutional Projection face** (decision nodes): a node's dimension weights derive from the resolved field's coordinates (the CCR basis) rather than re-deriving from the raw slice — one source of truth. `deriveWeightsFromStanding` generalises to `deriveWeightsFromCoordinates`.
- **Experience face** (lenses): lens bias applies over the coordinate vector, so per-archetype emphasis is a rotation in constitutional space (CFS-037 §5), not an ad-hoc per-dimension tweak.
- **Reasoning face** (`groundReasoning`): unchanged externally — but now the slice it returns is the IRE-resolved region, so grounding is intent-scoped by construction. **Amended 2026-07-27:** grounding is a *resolution* act, so `groundReasoning` is not an IPE face at all; it lives in `services/invariants/grounding.ts` on the IRE side of the seam. CFS-035's face 1 is retained as a numbering, not as a module the projector owns.
- **Evolution face**: the shadow loop already observes; it now also observes projection-vs-coordinate consistency (a CCR research signal).

**Backward-compatible by construction:** a bare `FieldSnapshot` (no coordinates) projects exactly as today (the coordinate path is additive, defaulting to the current standing-weight behaviour when coordinates are absent). Nothing that consumes CFS-035 today breaks.

## 3. The contract — IPE never resolves

The one invariant of this spec: **the IPE consumes a field; it never constructs one.** Any projector that reaches past its input field to re-ground or re-qualify an intent is an infraction (the parallel-resolver defect class — the identity-spine discipline applied to the field). If a projector needs more field, it asks the IRE to resolve more, it does not resolve itself.

**BOUND IN CODE, 2026-07-27 (`f7ab22432`).** The contract is no longer prose. `engine.ts` imports `FieldSnapshot` as a **type only**, exactly as `projectionBridge.ts` does, so the module is *structurally* incapable of resolving; a value import restores the ability and `tests/instrument-engine-briefs.test.ts` fails when one appears. **No self-resolving fallback is permitted** — the obvious shape (accept an injected field, resolve one when absent) is expressly prohibited, because it would unbind the mechanism from its upstream act at exactly the moment the binding matters. An absent field yields a faithful projection reporting `engaged: false`, which consumers must read as *nothing was computed*, never as a measurement. Which surfaces actually route through the IRE is recorded as queryable data in `GROUNDING_SURFACES` / `instrumentReadiness` (`services/invariants/resolution.ts`), never in a comment; five surfaces are IRE-routed, two independently governed, and two are classified `governed-unrouted` — so readiness reports UNREADY, and that verdict is the mechanism working.

## 4. Build plan (ratify-before-build)

- **Phase 0:** the doc rename (this spec + CFS-035 pointer) — done in spirit; the code-comment + seed passes staged (§1). **The §3 contract itself was bound in code on 2026-07-27 (`f7ab22432`), which the rename staging did not anticipate: enforcing "the IPE never resolves" required moving field construction out of `engine.ts`, not merely renaming prose.**
- **Phase 1:** `deriveWeightsFromCoordinates` — the additive coordinate path on the Constitutional Projection face, defaulting to current behaviour when coordinates are absent. Node-verifiable. **Shipped** (`services/invariants/engine.ts`).
- **Phase 2:** the IRE-resolved field wired as the nodes' input on one surface (discovery), shadow-first (CFS-017) — projection consumes resolution end-to-end, observed before authoritative. **Shipped as `services/invariants/projectionBridge.ts`**, which imports the resolved field as a type only and reports `comparable` so that vacuous agreement is never read as agreement.
- **Phase 3:** the Experience face's lens-over-coordinates rotation; the Evolution face's projection-consistency signal → the CCR research basis.

## 5. Honest limits

- **The rename touches 120 references** — low risk but not zero; the seed/appendix pass is the sensitive one (staged last, reviewed).
- **The coordinate path depends on the CCR** (CFS-038) being ratified + a basis existing; until then the IPE projects exactly as CFS-035 does today (the additive default).
- **No behaviour change ships in the rename** — identifiers stay; this is a concept + prose rename plus an additive coordinate seam.
- This spec seeds no invariant and gates no Chrysalis deliverable.

## Ratification record
- [x] **RATIFIED 2026-07-28** — PRD-IPE-001 filing. Ratified in full — the numbered items below are what the operator approved: (1) the rename scope + staging (§1); (2) the Resolved-Field consumption upgrade + the additive/backward-compatible coordinate path (§2); (3) the "IPE never resolves" contract (§3).

  Authority: operator act `ACT-IRE-FAMILY-2026-07-28`, decision id `CFS-039`, authority basis **Law XI — amending canon is an operator act**. Frozen content hash `sha256:682fddeaef3de8e1c04108e367174600431ba35d010432cad87984c4d7904294` (bytes after the IRE→IPE consistency corrections, before this record was written). Ledger row: `codexes/packs/polity-core/items/AMENDMENT_RECORDS.md`. The 2026-07-17 agent transcriptions are corroboration of intent, never the authority (Law XI).

- [ ] **DVN anchoring outstanding** — the act is recorded through `POST /api/governance/ratify`, which writes the `governance_ratifications` row, invokes `createGovernanceReceipt` and enters the DVN pipeline. Until an operator runs it, this document's ratification exists in the repo ledger and not yet on chain.
