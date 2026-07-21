# CFS-037 / PRD-IRE-001 — The Invariant Resolution Engine (IRE)

**Status:** Architectural Foundation — DRAFT, awaiting operator ratification (2026-07-17).
**Classification:** Constitutional Runtime Primitive.
**Designation:** This is the IRL ratified-spec filing of the operator/Aletheon **PRD-IRE-001**. The proposed PRD family (PRD-IRE/KRE/IPE/CFO/CCR-001) maps onto the IRL's `CFS-nnn` convention rather than introducing a parallel numbering scheme (the EXP-006 collision discipline) — this is **CFS-037**, carrying the **PRD-IRE-001** designation; the siblings are named in §9 as future CFS specs.
**Dependencies:** Constitutional field substrate · Invariant Registry (`services/invariants/store.ts`) · `IntentQubeRecord` (`services/iqube/intentQube.ts`) · CFS-035 (renamed here → the **Invariant Projection Engine**) · future KRE / CFO / CCR.
**Companion:** CFS-035 (Invariant Projection Engine — the projector this resolves *for*), CRP-002 (intent-as-projection; the three compressions), CFS-002 (the iQube ontology this **extends, never replaces** — operator directive 2026-07-17).

---

## 0. What this is, and the disciplines that govern it

The operator + Aletheon have converged on the stage **before** the engine. CFS-035's Invariant Engine *reasons over* invariants; something has to determine *which invariants matter* for a given intent. That is a different problem — and it is the constitutional analogue of a **query planner**: analyse the intent, resolve the relevant structures, estimate costs, choose a strategy, and only then invoke execution. The IRE is that planner.

Four disciplines bind this spec:

1. **Code is truth** (operator, this session). §2 is a code-witnessed reconciliation; ~70% of the IRE's substrate already exists and is composed here, not re-asserted.
2. **Extension, not replacement** (operator directive, 2026-07-17): "the iQube definitions proposed above are extensions and honing evolutions, not replacements of earlier definitions." Every construct below maps onto an existing one (§8).
3. **Ratify before build.** This is the ratification gate; no engine code ships until §12's plan is ratified. Phase 0 is shadow-first (CFS-017).
4. **Axis precision** (CFS-019): the naming collision on "Constitutional Field" is resolved in §6, not glossed.

---

## 1. The architectural inversion — resolution precedes reasoning

Most AI stacks are `retrieve → reason`. This architecture is `resolve → curate → compose → reason`, where reasoning is the **last resort, not the first move**. Two engines, cleanly separated:

```
Intent
  │
  ▼
Invariant Resolution Engine (IRE)     ← "What constitutional field does this intent require?"   [NEW — this spec]
  │
  ▼
Resolved Constitutional Field
  │
  ▼
Knowledge Resolution Engine (KRE)     ← "Is that field already realised in knowledge (iQubes)?"  [future, §9]
  │
  ▼
Invariant Projection Engine (IPE)     ← "Given the field, how should the platform behave?"        [CFS-035, renamed]
  │
  ▼
Reasoning (only where genuinely required) → Execution → Receipts → Cultivation
```

**The rename** (ratification decision): CFS-035's "Invariant Engine" becomes the **Invariant Projection Engine (IPE)** — it *projects and applies* a field. The IRE *constructs* the field. "Engine" was overloaded; resolution vs projection is a clean separation of concerns. The IPE never resolves invariants; it always consumes a field the IRE produced. (Rename scope: §12 — 120 doc/comment references, low code risk; no exported symbol is literally `InvariantEngine`.)

---

## 2. Code-truth reconciliation — what already exists (the ~70%)

Witnessed by a read-only inventory, 2026-07-17. This is the spine; the IRE composes it.

| IRE substrate | Verdict | Existing seam | IRE relationship |
|---|---|---|---|
| Intent envelope | **Exists (shallow)** | `IntentQubeRecord` + `createIntentQube` (`services/iqube/intentQube.ts`); `/api/assistant/intent` | **Extend** with resolution fields (objectives/constraints/authority/stakeholders/success-criteria) + the promised `intent_qubes` table |
| Input → grounding context | **Exists (v0)** | `perception.extractField` / `groundFromInput` (`services/invariants/perception.ts`) — deterministic keyword estimator | **Extend** — the seed of Qualification/Resolution; semantic perception is the Gen-3 drop-in |
| Invariant retrieval | **Exists (mature)** | `buildInvariantSlice` + `GroundingContext` + `InvariantSlice` (`services/invariants/grounding.ts`), standing-primary ranking | **Reuse** — this IS baseline curation |
| Field object | **Exists** | `FieldSnapshot {stampedAt, context, slice, citedIds}` (`services/invariants/engine.ts`) | **Extend** → the Resolved Constitutional Field adds resolved intent + coordinates (§6) |
| Standing-weighted calibration | **Exists** | `deriveWeightsFromStanding`, lens biases (`experience.ts`) | **Reuse** the normalisation math; build coordinates atop it |
| iQube calibrated axes | **Exists** | `IQubeScoreBlock` (sensitivity/accuracy/verifiability/risk + derived reliability/trust, each with `_source: derived\|operator_override`) (`types/registry-canonical.ts`) | **Extend** — the coordinate/override-provenance pattern already exists at the iQube level; lift it to invariants (§5/§8) |
| iQube lifecycle | **Exists (unnamed)** | `IQubeLifecycleState` (draft/wip/canonized/deprecated/archived) (`types/iqube/legibility.ts`) | **Map** curate/calibrate/consume/cultivate onto it (§7) — no new lifecycle |
| Knowledge discovery | **Exists** | `discoverCapabilities` (matches/gaps/recommendation), `recommendProducers` (CFS-028) | **Reuse** (future KRE substrate) |
| **Per-invariant coordinate vector** | **ABSENT** | per-node dimensions + lens biases exist; no unified per-invariant coordinate | **NEW** (§5) |
| **Intent Qualification** ("right problem?") | **ABSENT** | — | **NEW** (§3.1) |
| **Reuse-before-create composition** | **ABSENT** | discovery finds gaps but never closes into reuse/compose/create | **NEW** (future KRE, §9) |

**Takeaway:** the IRE is mostly the *formalisation + enrichment* of three existing seams (`perception` → `buildInvariantSlice` → `FieldSnapshot`) plus three genuinely new pieces: intent qualification, the coordinate vector, and (in the KRE) reuse-before-create.

---

## 3. The IRE pipeline — five phases

### 3.1 Qualification — "what is the constitutional problem?" *(NEW)*
Not parsing the request ("build me an AI") but resolving the actual problem ("reduce administrative burden") — a different field, different invariants, different agents. Prevents optimising the wrong objective. Output: a **qualified intent**. This is Aletheon's "Constitutional Qualification" — the earliest primitive, genuinely new.

### 3.2 Universal Invariant Resolution *(extends `buildInvariantSlice`)*
Every intent passes through the same **Universal Invariant Library** (§4) — the immutable baseline. Composes `buildInvariantSlice` over the universal namespace set, seeded from the qualified intent.

### 3.3 Domain Expansion *(extends grounding by namespace/domain)*
Only *after* the baseline: add domain → organisation → user → intent-specific invariants. `Universal → Domain → Intent`, never the reverse. The universal layer stays immutable.

### 3.4 Calibration — Constitutional Coordinates *(NEW; §5)*
Each resolved invariant is located in a shared coordinate system — not a bag of scores, the **topology of the field**. Reuses `deriveWeightsFromStanding` + lens normalisation; the coordinate representation is new.

### 3.5 Field Assembly *(extends `FieldSnapshot`)*
Produce the **Resolved Constitutional Field** (§6): resolved invariants + coordinate topology + receipts + provenance + confidence. One canonical object every downstream consumer reads.

---

## 4. The Universal Invariant Library — the baseline nodes

A **deliberately small, ratified** set every intent passes through. Candidate baseline (unseeded — introduced only through the Constitutional Research process, never assumed complete):

Personhood · Identity · Authority · Consent · Privacy · Trust · Accountability · Standing · Evidence · Provenance · Verifiability · Risk · Time-to-Value · Repair Cost · Delegability · Constitutional Integrity.

Each becomes a baseline invariant node answering a universal constitutional question (e.g. Time-to-Value: "what collapses time?"; Repair Cost: "what minimises future repair?"; Personhood: "does this preserve human continuity and agency?"). These are **candidates**, not seeded — a future seed-and-ratify pass renumbers them into the crystal's `inv.<namespace>.<n>` scheme (the CRP-003 discipline). The runtime must **never assume the library is complete**; invariant discovery is ongoing science.

**Stable operational basis vs evolving research basis** (Aletheon): the library is the canonical *basis vectors* of the field — human-designed and ratified early, but the IRL continuously tests whether some are redundant, whether new dimensions emerge, or whether a domain needs extra basis vectors. The runtime stays stable while the science evolves underneath.

---

## 5. Constitutional Coordinates — the bridge *(NEW)*

The breakthrough abstraction: every invariant (and every intent, iQube, agent-team, workflow) becomes a **point/region in constitutional space**, so the runtime can compare them *geometrically* — field navigation, not keyword/vector search. Three classes:

- **Structural coordinates** (describe the *problem*, actor-independent, reusable across domains): Complexity · Evidence Density · Uncertainty · Sensitivity · Risk · Scope · Verifiability.
- **Constitutional coordinates** (describe the *constitutional relationship*, vary by actor/org/polity): Authority · Standing · Delegability · Consent · Accountability · Sovereignty · Identity Protection · Trust · Personhood Impact.
- **Operational coordinates** (describe the *execution economics*): Time-to-Value · Repair Cost · Reuse Potential · Automation Potential · Knowledge Coverage.

These are **provisional** and evolve through research (the CCR, §9). They EXTEND, not replace, the existing calibrated-axis pattern: `IQubeScoreBlock` already carries calibrated axes with `_source: derived | operator_override` provenance and a `derivation_strategy` — the coordinate system lifts that exact pattern from the iQube level to the invariant level and adds the geometry. This is a semantic upgrade of `deriveWeightsFromStanding` from per-node scalar weights to a shared multi-axis basis.

**Why geometry matters:** today's AI operates in *semantic* space (embeddings — "these ideas are close"). Constitutional coordinates add *constitutional* space — "these intents/artifacts/agents occupy the same constitutional region." That enables topographic reasoning (follow gradients: minimise repair cost, maximise evidence, increase standing), constitutional proximity (discover iQubes/workflows/agent-teams in the same region), and field dynamics (movement over time → a natural basis for progressive sovereignty + standing evolution).

---

## 6. The Resolved Constitutional Field — and the naming reconciliation

**Naming collision, resolved (axis precision).** "Constitutional Field" already names a *visualization* (`components/registry/FieldView.tsx`, MetaVitruvian / Bearing Instrument, `types/representation.ts` sectors) AND the ambient substrate the Observatory renders. The IRE does **not** rename those. Precise register:

- **The (global) Constitutional Field** = the whole invariant substrate — what the Observatory visualizes. Unchanged.
- **The Resolved Constitutional Field** (IRE output) = a *per-intent region* of that field + its calibrated coordinates. This is the runtime object the IRE assembles — a strict **extension of the existing `FieldSnapshot`** (`{stampedAt, context, slice, citedIds}` → `+ resolvedIntent, + coordinates, + receipts, + confidence`).

This maps exactly to Aletheon's reframing: you don't match an intent to an iQube, you match an intent to a *region of the constitutional field*; iQubes are the assets that occupy that region. `Intent → Field → iQube selection → Agent assembly`, never `Intent → iQubes`.

---

## 7. The lifecycle — Curate → Calibrate → Consume → **Cultivate**

The IRE recursively applies the **iQube lifecycle to intelligence itself** — an elegant property: the constitutional runtime uses its own architecture. Extended with a fourth C:

- **Curate** = Qualification + Resolution + Expansion (which invariants matter).
- **Calibrate** = the coordinate estimation (§5).
- **Consume** = projection + execution (the IPE + downstream).
- **Cultivate** *(new fourth C)* = receipts → new constitutional knowledge → field/library refinement. The learning loop.

This is **mapped onto** the existing `IQubeLifecycleState` (draft/wip/canonized/deprecated/archived), not a replacement — curate≈draft/wip, consume≈canonized-in-use, cultivate≈the observation→research→ratification path already in CFS-031's cybernetic loop. The recursion is the point: every execution expands the constitutional topology, so the next intent begins from a richer field — the platform gets smarter by expanding its constitutional space, not just its weights.

---

## 8. iQube ontology — evolution, not replacement (operator directive)

Per the operator's closing instruction (2026-07-17), everything here **hones and extends** prior canon:

- **IntentQube** — the existing `IntentQubeRecord` gains resolution fields + a real table; the create/route/receipt plumbing is unchanged.
- **Constitutional coordinates** — extend `IQubeScoreBlock`'s calibrated-axis + derived/override-provenance pattern (already canonical) to the invariant level; the four native iQube axes (sensitivity/verifiability/accuracy/risk) become structural coordinates, not new inventions.
- **iQube = constitutional realisation** — a subtle honing of "iQube as knowledge container": an iQube exists because a constitutional region was resolved before; retrieval asks "has this constitutional region already been solved?" This *reframes*, it does not replace, CFS-002's definitions.
- **Lifecycle** — curate/calibrate/consume/cultivate names the existing lifecycle's constitutional reading; the DB states are untouched.

No prior definition is superseded. Where a construct sharpens an earlier one, this spec records it as a refinement (the CFS-019 "discover → reconcile → extend" method).

---

## 9. The future PRD family (named, not built here)

- **PRD-KRE-001 — Knowledge Resolution Engine.** "Is the field already realised in knowledge?" The `Discover → Evaluate → Compose → Realise → Register → Reuse` loop — the constitutional form of "reuse where possible, create where needed" (now a constitutional invariant governing knowledge itself). Its substrate exists (`discoverCapabilities`, `recommendProducers`); the reuse-before-create composition + realisation-becomes-canonical loop is the new work. Pre-reasoning: iQube selection/composition happens *before* the LLM.
- **PRD-IPE-001 — Invariant Projection Engine.** The renamed CFS-035 — projects a field into ranking / routing / UX / governance / agent assembly / policy. Consumes a field; never resolves one.
- **PRD-CFO-001 — Constitutional Field Observatory.** Extends the existing Observatory (CFS-035 amendment) with coordinate topology + operational telemetry.
- **PRD-CCR-001 — Constitutional Coordinates Registry.** Definition, evolution, governance, and ratification of the coordinate basis (the stable-operational vs evolving-research split, §4).

---

## 10. Pre-reasoning doctrine — three intelligences

The runtime reasons over **prepared constitutional knowledge, not raw knowledge**. Three distinct forms, in order:

1. **Constitutional Intelligence** (IRE) — what field does the intent require?
2. **Knowledge Intelligence** (KRE) — what constitutional knowledge already exists? (reuse/compose/create)
3. **Reasoning Intelligence** (IPE + LLM) — synthesise/plan/generate, *only where genuinely required*.

Invariant discovery, iQube curation, and composition are all **pre-reasoning** — the intellectual work done before the LLM begins, making the reasoning phase smaller, cheaper, more explainable, more reproducible, more constitutional. The primary runtime is no longer an LLM or agent runtime; it is a **constitutional runtime** whose first-class primitives are field construction, knowledge realisation, and constitutional projection.

---

## 11. Success metrics (constitutional, not merely technical)

Field Resolution Coverage · Knowledge Reuse Rate (fields satisfied by existing iQubes vs newly generated) · Reasoning Reduction (prompt size / LLM calls saved by upstream constitutional computation) · Projection Consistency (downstream systems agree when consuming the same field) · Time-to-Value Improvement · Repair Cost Reduction · Constitutional Explainability (decisions traceable through invariant receipts to field coordinates). These enter the same experimental pipeline every CCE/CIE experiment uses; none has an operationalised metric yet (honest — §13).

---

## 12. Rollout — Phase 0 shadow-first (ratify-before-build)

- **Phase 0 (pilot, shadow — CFS-017):** an `IRE` service seam that, from an intent, produces a **Resolved Constitutional Field** *alongside* the current path — composing `perception.groundFromInput` (Qualify/Resolve v0) + `buildInvariantSlice` (curate) + a first coordinate calibration over `deriveWeightsFromStanding`, extending `FieldSnapshot`. It **observes**, never gates. Receipts the field it would have produced. First proving ground: the **Horizen pilot** (CRP-003a) — resolve the field for a financial intent and compare against the hand-specified grounding the pipeline uses today.
- **Phase 1:** the Universal Invariant Library seeded + ratified (§4); Qualification as a real stage.
- **Phase 2:** the Constitutional Coordinates as a first-class per-invariant vector (§5) + the CCR (basis governance).
- **Phase 3:** the IPE consumes the Resolved Field (the CFS-035 rename increment — 120 refs, low code risk, its own tracked change); the KRE reuse-before-create loop.
- **Cultivation:** receipts → research → library/coordinate evolution, continuous.

The **rename** (Invariant Engine → IPE) is a **separate tracked increment**, not bundled here — the shipped CFS-035 surface (Observatory, flip, nodes) stays stable while the doc/comment rename lands incrementally.

---

## 13. Honest limits

- **Nothing here is built.** This is the ratification gate. §2 is code-witnessed; §3–12 are proposed.
- **Qualification, the coordinate vector, and reuse-before-create are genuinely new** — the rest is formalisation of existing seams.
- **The Universal Invariant Library + all coordinates are candidates, unseeded.** They enter via the Constitutional Research process; the runtime never assumes completeness.
- **Perception is a v0 keyword heuristic** — semantic/embedding qualification is the Gen-3 drop-in.
- **No coordinate has an operationalised metric yet** — "field strength," "constitutional proximity," and the geometry are proposed concepts (the CFS-019 Field Theory amendment), not yet reduced to computation. The first Horizen run is where that definition work begins.
- **Naming collision with the Observatory/Bearing visualization** is resolved by register (§6), not by renaming shipped surfaces.
- **This spec seeds no invariant** and sequences/gates no Chrysalis deliverable (CRP-001 interface rule).

## Ratification record

- [ ] **DRAFT 2026-07-17** — authored from the operator/Aletheon PRD-IRE-001 + pre-reasoning dialogue, reconciled against a code-truth inventory. Awaiting operator ratification of: (1) the IRE/IPE separation + CFS-035 rename to Invariant Projection Engine; (2) the Universal Invariant Library baseline (§4); (3) the three coordinate classes (§5); (4) the four-C lifecycle (§7); (5) the Phase-0 shadow build (§12).
