# Research Line — Invariant Software Engineering

**Chrysalis Foundation · Invariant Research Lab · New research line charter · Status: PROPOSED (docs-first) 2026-07-21**
**First experiment:** `ISR-001 — Invariant Software Reduction` (this directory, `README.md`).
**Constitutional anchor:** `foundation/CRP-001_constitutional-research-program-charter.md` (the research-programme framing), `foundation/CFS-034_research-progression-ladder.md` (how experiments ladder up), the Invariant Engine trilogy (`CFS-035` / `CFS-037` / `CFS-039`).

---

## 1. Thesis

Every other IRL line asks what invariants do for **reasoning and knowledge**. This line asks what they do for **software itself**:

> **A software capability is not an arbitrary pile of code — it has a minimum sufficient causal structure that can be made explicit as an invariant set, and that invariant set can drive reduction, re-projection, verification, and evolution of the capability while provably preserving what matters (behaviour, governance/constitutional properties, robustness, and evolvability).**

Where conventional software engineering preserves behaviour by *vigilance* (tests going green, careful refactoring, reviewer judgement), Invariant Software Engineering aims to preserve behaviour by *derivation*: state the invariants, and both what-must-stay and what-may-go become computable rather than intuited. The line's founding empirical claims — all `proposed` until evidence arrives — are ISR-001's ISR-H1/H2/H3: a minimum sufficient causal structure **exists** (H1), is **derivable from invariants** (H2), and yields **preservation-weighted compression conventional optimisation does not** (H3).

The originating spark is a completed piece of production work — the Amplify SSR bundle pruning (`agentiq/updates/2026-07-21_pack-corpus-remote-store.md`) — framed by ISR-001 as **Phase Zero**: a real reduction under a real ceiling, done well but *without* an explicit invariant model, so its preservation was asserted, not derived. This line formalises the question that success left open.

## 2. Why it is distinct from the existing (intelligence-focused) experiments

The IRL's experiment slate to date studies **intelligence** — whether invariant *fields* carry reasoning capacity (EXP-P2 structural, EXP-P1 comparative), what becomes *practical* once reasoning is compressed into a reusable field (EXP-P3 capability), and whether the *engines* that resolve/project fields are sound instruments (`irv-001`, `ipv-001`). Their object is **knowledge**; their metric is **derivation accuracy / reasoning capacity**.

Invariant Software Engineering shares the substrate and the discipline but changes the object and the metric:

| | Existing intelligence lines | Invariant Software Engineering (this line) |
|---|---|---|
| **Object of study** | A knowledge corpus / invariant field | A running software capability |
| **Core question** | Does structure carry reasoning capacity? | Does a capability have a derivable minimum causal structure? |
| **Metric family** | Derivation accuracy, coverage, K* on knowledge | Compression × preservation (BPS, ISCR, Effective Invariant Compression), operational health |
| **Uses the engines as** | The thing under test | Instruments applied *to code* (IRE resolves a capability's invariants; IPE re-projects it) |
| **Success looks like** | "Reasoning rides structure, not bulk" | "Behaviour rides the causal core, not the code bulk" |

The two are **complementary, never interchangeable** — a result in one may not be cited as evidence for the other (the EXP-P1/P2 non-cross-citation discipline). This line is the software-substrate reflection of `inv.reasoning.322`/`.323`: if value/reasoning rides structure not bulk in knowledge, the same should hold in code — and `inv.reasoning.330` (an invariant is a transferable reasoning primitive, independent of the intelligence that discovered it) is precisely what licenses carrying the invariant lens across the boundary from knowledge to software.

## 3. The ladder of experiments (CFS-034)

Per CFS-034, a line ladders from instrument-in-use demonstrations toward ratified engineering discipline; findings are proposed upward through the constitutional process, never auto-canonised. The line's planned rungs (ISR-001 first; the rest are sketched follow-ons, `proposed`, not yet chartered):

1. **ISR-001 — Invariant Software Reduction** *(first; chartered here).* On ONE bounded, non-transactional capability, compare four arms (existing / conventional optimisation / invariant-flattened / invariant-projected) on preservation-weighted compression. Establishes whether the minimum causal structure exists and is invariant-derivable at all.
2. **ISR-002 — Invariant-Guarded Refactoring** *(sketch).* Flip the question from *reduce* to *change*: given the four-class preservation contract as a live gate, can a capability be refactored/extended with the invariant set as the authority on what a change may and may not break — measured as reduced regression rate + smaller review blast-radius vs conventional refactoring. Directly operationalises the *evolution invariant* class (the E factor) as a standing tool. Composes the CFS-017 shadow-first discipline (observe before authoritative).
3. **ISR-003 — Duplicate-Capability Convergence via Invariants** *(sketch).* Take two implementations of one capability (the CS-001 duplicate-capability drift defect) and test whether resolving both to their invariant sets exposes the shared causal core and drives principled convergence to one authoritative implementation — turning "Extend, Don't Duplicate" from a rule into a measured procedure. Relates to `cce-006`/`cce-007` (constitutional capability convergence / reconciliation).
4. **ISR-004 — Cross-Capability Invariant Reuse** *(sketch, frontier).* Test whether structural invariants discovered for one capability transfer to reduce/project a *sibling* capability (the software analogue of EXP-P2 B5's field-structure claims and `inv.reasoning.008` — an invariant does not change with its domain, its context does). The rung where "Invariant Software Engineering" would begin to resemble a reusable engineering discipline rather than a per-capability study.

Each rung reuses the same rigour (frozen bundle, hash-committed contract, variance bands, signed interpretation table, honest nulls) and publishes through the canonical receipted pipeline, submittable via CFS-042 (Phase 1 admin door / Phase 2 passport-delegated).

## 4. Connection to the Invariant Engine trilogy

The line does not build new engines — it **applies the trilogy to code** and, in doing so, validates them in a new mode:

- **Discovery / Resolution (CFS-037, the IRE)** — resolves *which* invariants govern a capability's intent (Arm C of ISR-001, and the gate in ISR-002). Its instrument was validated by `irv-001` (stability 1.0).
- **Projection (CFS-039 / CFS-035, the IPE)** — projects a resolved invariant set into a fresh implementation (Arm D of ISR-001). It **never resolves** (CFS-039 §3): it consumes the field the IRE produced. Its instrument was validated by `ipv-001` (reproducibility).
- **The Invariant Engine (CFS-035)** — the projection substrate whose four faces (Reasoning / Constitutional Projection / Experience / Evolution) this line reads when it turns a capability's field into behaviour.

Running the engines *against software* is itself a stress test of the trilogy: if the IRE can resolve a capability's governing invariants and the IPE can re-project the capability from them with behaviour preserved, that is strong in-use evidence that the resolution→projection separation is real and load-bearing beyond the knowledge domain it was designed for.

## 5. Governance & epistemic discipline

- **Everything empirical stays `proposed`.** ISR-H1/H2/H3 and every downstream-rung hypothesis remain `proposed` until their experiment produces supporting evidence (CLAUDE.md "Hypothesis vs Canon"; `appendix-a_canonical-invariants.md`). A compelling thesis is not a ratified one. Definitions and methods this line ratifies (e.g. the four invariant classes as a preservation *contract*) may become `canonical` as **method**, but the claims those methods test may not.
- **CRP-001 interface rule.** This line *feeds* Chrysalis; it never gates a Chrysalis deliverable. Findings hand back as ratification proposals; production telemetry (like Phase Zero's bundle metrics) becomes research data — the shared flywheel.
- **Ratification via the ladder (CFS-034).** Climbing the line's ladder grants the *authority to propose and, at steward rung, to ratify* — never automatic canonisation. Standing is earned per contribution (reproduction, evidence, protocol improvement), never purchased.
- **The AVOID list is a line-level constraint, not a per-experiment one.** For this line's first phase, no experiment touches Polity Passport, standing/delegation, payments/QriptoCENT/MoneyPenny, the identity spine, or the DVN pipeline. Invariant Software Engineering earns the right to approach higher-risk capabilities only after it demonstrates preservation-by-derivation on bounded, non-transactional ones.

## 6. One-line summary

**Invariant Software Engineering is the research line that treats a software capability as an object with a discoverable minimum causal structure — and tests whether making that structure explicit, as invariants, lets us reduce, rebuild, guard, and evolve software while proving (not hoping) that behaviour, governance, robustness, and evolvability survive. ISR-001 is its first, deliberately low-risk experiment.**
