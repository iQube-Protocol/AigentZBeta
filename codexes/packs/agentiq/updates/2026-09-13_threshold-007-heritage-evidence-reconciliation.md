# Threshold 007 — Heritage Evidence Reconciliation (Temporal/Consequence Lineage, IRL-010A Correction, Constitutional Consequence Deviation Rename)

**Date:** 2026-09-13
**File:** `docs/qriptopian/thresholds/007-research-edition.md`, `docs/qriptopian/thresholds/007-reading-edition.md`

## What this pass did

Completed the targeted, operator-directed Evidence Agent heritage search (items 5-7 of the 2026-09-13
directive) and applied the reconciled findings as a single evidence-register edit, per operator
approval with adjustments. Full findings were presented to the operator as a proposed delta before any
write; this doc records what was actually applied.

## Applied changes

1. **IRL-010 / IRL-010A corrected from Unresolved to Resolved**, with an explicit provenance note: both
   files exist in this repository (`codexes/packs/irl/foundation/IRL-010_constitutional-runtime-technical-specification.md`,
   `IRL-010A_claims-traceability-matrix.md`) and were wrongly carried forward as "external File Library
   only" across at least two prior evidence passes, including the first draft of this very pass. Row
   1.11 of IRL-010A was opened and verified verbatim against Threshold 006's own citation of it.
2. **Tacit capability discovery** recorded as Hypothesized/Experimental with `loadBearingAsEvidence:
   false` / `loadBearing as research question: true` — the absence of prior doctrine is not itself
   evidence for the hypothesis.
3. **Consequence Horizon frontier metric kept distinct from Authorized Action Horizon**: `CH_Invariant
   > CH_Baseline` is the new H1b experimental proposition; `Authorized Action Horizon ≤
   Constitutionally Warranted Consequence Horizon` is a separate new candidate constitutional
   invariant belonging primarily to the constitutional-control/Trusted Superintelligence argument, not
   to H1b.
4. **New register row for `CH_Invariant > CH_Baseline`** as its own entry: Hypothesized / Not Yet
   Registered or Executed, Newly proposed in 007.
5. **Renamed "constitutional drift" to "Constitutional Consequence Deviation"** (`D_cc`, drift rate
   `ΔD_cc/ΔC`) in both the Research Edition (§27/§29 area) and the Reading Edition (§28), to resolve a
   naming collision with this repository's existing, unrelated use of "constitutional drift" in
   `codexes/packs/irl/foundation/CS-001_duplicate-capability-as-constitutional-drift.md` (duplicate-
   capability/state-amnesia defects). CS-001's own usage is untouched.
6. **Removed unsupported exact-quote attribution to Threshold 005** for "sovereign time," "finite
   time," "not merely an efficiency metric," and the extended Verification-Friction/TTV delegation
   chain — none of that exact wording exists anywhere in this repository's copy of 005. Relocated the
   *supported* underlying claims (sovereign time, Time-to-Value/Time-to-Repair, Proof of Time Saved as
   compression not marketing) to their actual, verified source: **COYN Thesis Paper 2, "Time
   Sovereignty"** (`codexes/packs/polity-core/items/commentary/coyn-thesis/02-time-sovereignty.md`).
   Threshold 005 now supports only what it demonstrably contains: warranted trust, Raw/Effective
   Capability, and Operational Trust.
7. **Threshold 006 Consequence Horizon kept explicitly as inherited doctrine**, distinguished from
   007's new calibrated-frontier-metric proposition (item 4 above) — a future reader should never
   mistake 006 for having already proposed the H1b experimental test.
8. **EXP-P1–P4 recorded strictly at their actual maturity**: no execution or results implied for any
   of the four. `CH_Invariant > CH_Baseline` cannot currently be measured by any registered protocol.
9. **New proposed experiment `EXP-P2-CH` — Consequence Horizon Calibration Arm** — added as a
   `Proposed / Not Registered` entry, deliberately given its own child identifier rather than edited
   into EXP-P2 (mid-freeze, placeholders unresolved) or folded into reserved EXP-P4 (a different
   hypothesis class: interaction/field-behavior, not calibration).
10. **Novelty status column preserved throughout**: `Inherited` / `Synthesized` / `Newly proposed in
    007`, applied to every row in the new lineage register.

All of this was added as a new, clearly-labeled section — **"Temporal, Consequence and
Constitutional-Control Lineage Register"** — near the end of the Research Edition, plus a dedicated
provenance note for the IRL-010/IRL-010A correction and the terminology-rename edits in place. No
other prose in Aletheon's manuscript was rewritten.

## What this establishes about the research programme's own coherence

The reconciled lineage is now visible end to end: **COYN Thesis → Experience Sovereignty → Polity
Embodied → Constitutional Computing (004) → Trusted Intelligence (005) → Consequence Horizon (006) →
Invariant Intelligence (007)**. Time, risk and consequence did not appear newly in 007 — they have been
present and developing across this corpus since the COYN Thesis. What 007 adds is their **synthesis
into a falsifiable theory of intelligence and frontier extension**, not their invention. This is a
stronger intellectual position than "007 introduces temporal reasoning," and it is now stated as such
in the manuscript's own lineage register rather than left implicit.

## Gate state after this pass

Per the operator's explicit instruction: recompute the candidate manuscript hash, and set
`evidence_resolved = true` only if all accepted register changes are actually present with no evidence
regression. See the companion Supabase sync for the resulting hash and gate row. `arr_disposition`
remains `null` — no ARR was run in this pass, and none of the corrections above constitute or imply an
adversarial review.
