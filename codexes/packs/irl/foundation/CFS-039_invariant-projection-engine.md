# CFS-039 / PRD-IPE-001 — The Invariant Projection Engine (IPE)

**Status:** Architectural Foundation — DRAFT, awaiting operator ratification (2026-07-17).
**Classification:** Constitutional Runtime Primitive (the projector).
**Designation:** IRL ratified-spec filing of **PRD-IPE-001** (the PRD family, §9 of CFS-037). This spec **renames and re-scopes CFS-035** — it does not replace it; CFS-035's content (the governing law, the four faces, the node schema, the Observatory) stands, now under the IPE identity.
**Dependencies:** CFS-035 (the engine being renamed), CFS-037 (IRE — produces the field the IPE consumes), CFS-038 (CCR — the coordinate basis the IPE projects against).

---

## 0. The separation this completes

CFS-037 split the overloaded "engine" into resolution and projection. The **IRE constructs** the Resolved Constitutional Field; the **IPE projects** it into platform behaviour — ranking, routing, UX, governance, agent assembly, policy, recommendations. This spec makes the projection half explicit: the IPE **never resolves** invariants; it always consumes a field the IRE produced.

CFS-035 already *is* the IPE in all but name — the four faces (Reasoning · Constitutional Projection · Experience · Evolution), the `FieldSnapshot`, the decision nodes, the shadow loop, the Observatory. This spec renames it and upgrades what it consumes.

## 1. The rename — scope + discipline

"Invariant Engine" → **Invariant Projection Engine (IPE)**. Code-truth (2026-07-17 inventory): **120 references across 47 files**, but **low code risk** — no exported symbol is literally `InvariantEngine`; the load-bearing identifiers are `FieldSnapshot` / `computeFieldSnapshot` / `groundReasoning` / the node registry, which **keep their names**. The rename is overwhelmingly **doc + comment**, plus:

- `codexes/packs/irl/foundation/CFS-035_the-invariant-engine.md` — the canonical doc (already carries the rename pointer, 2026-07-17).
- Comments in `services/invariants/engine.ts` (12), `experience.ts`, the node files, the tests.
- Seed/appendix text (`canonical-invariants.seed.json` 14, `appendix-a` 6) — **highest-churn; touch last, carefully** (seed edits are money-adjacent to ingestion — CS-001 discipline).

**Rename is its own incremental change**, staged so the shipped CFS-035 surface (Observatory, flip, nodes) never destabilises: (a) docs + this spec first; (b) code comments; (c) seed/appendix text last, in one reviewed pass. No behaviour changes — identifiers stay, only prose + the concept name move.

## 2. The upgrade — projecting a Resolved Field (not a bare snapshot)

Today the IPE's faces consume a `FieldSnapshot` (`{context, slice, citedIds}`). CFS-037's IRE produces a richer **Resolved Constitutional Field** (`+ resolvedIntent, + coordinates, + operational`). The IPE upgrade: its projectors read the **coordinates**, not just the slice.

- **Constitutional Projection face** (decision nodes): a node's dimension weights derive from the resolved field's coordinates (the CCR basis) rather than re-deriving from the raw slice — one source of truth. `deriveWeightsFromStanding` generalises to `deriveWeightsFromCoordinates`.
- **Experience face** (lenses): lens bias applies over the coordinate vector, so per-archetype emphasis is a rotation in constitutional space (CFS-037 §5), not an ad-hoc per-dimension tweak.
- **Reasoning face** (`groundReasoning`): unchanged externally — but now the slice it returns is the IRE-resolved region, so grounding is intent-scoped by construction.
- **Evolution face**: the shadow loop already observes; it now also observes projection-vs-coordinate consistency (a CCR research signal).

**Backward-compatible by construction:** a bare `FieldSnapshot` (no coordinates) projects exactly as today (the coordinate path is additive, defaulting to the current standing-weight behaviour when coordinates are absent). Nothing that consumes CFS-035 today breaks.

## 3. The contract — IPE never resolves

The one invariant of this spec: **the IPE consumes a field; it never constructs one.** Any projector that reaches past its input field to re-ground or re-qualify an intent is an infraction (the parallel-resolver defect class — the identity-spine discipline applied to the field). If a projector needs more field, it asks the IRE to resolve more, it does not resolve itself.

## 4. Build plan (ratify-before-build)

- **Phase 0:** the doc rename (this spec + CFS-035 pointer) — done in spirit; the code-comment + seed passes staged (§1).
- **Phase 1:** `deriveWeightsFromCoordinates` — the additive coordinate path on the Constitutional Projection face, defaulting to current behaviour when coordinates are absent. Node-verifiable.
- **Phase 2:** the IRE-resolved field wired as the nodes' input on one surface (discovery), shadow-first (CFS-017) — projection consumes resolution end-to-end, observed before authoritative.
- **Phase 3:** the Experience face's lens-over-coordinates rotation; the Evolution face's projection-consistency signal → the CCR research basis.

## 5. Honest limits

- **The rename touches 120 references** — low risk but not zero; the seed/appendix pass is the sensitive one (staged last, reviewed).
- **The coordinate path depends on the CCR** (CFS-038) being ratified + a basis existing; until then the IPE projects exactly as CFS-035 does today (the additive default).
- **No behaviour change ships in the rename** — identifiers stay; this is a concept + prose rename plus an additive coordinate seam.
- This spec seeds no invariant and gates no Chrysalis deliverable.

## Ratification record
- [ ] **DRAFT 2026-07-17** — PRD-IPE-001 filing. Awaiting operator ratification of: (1) the rename scope + staging (§1); (2) the Resolved-Field consumption upgrade + the additive/backward-compatible coordinate path (§2); (3) the "IPE never resolves" contract (§3).
