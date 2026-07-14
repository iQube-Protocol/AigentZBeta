# EXP-006 — Constitutional Knowledge Evolution

**The institute's first longitudinal experiment series.** Charter · status: DESIGN (deferred by operator direction 2026-07-14 — the hypothesis matured faster than the experiment; deferring for the stronger design beats a faster weaker answer).

> Designation note: this series was proposed in review as "EXP-005"; that slot is held by Provider Choice, so it is assigned **EXP-006**. (CCE-006 is a distinct taxonomy prefix — Constitutional Computing Experiment; this is an EXP-series longitudinal study.) Operator confirms the designation and whether it should carry a taxonomy class.

## Why this is a new series, not "EXP-003 Run 002"

Everything the lab has measured so far is **static** — `Knowledge → Reasoning → Measurement`. This series is **dynamical**:

```
Knowledge → Reasoning → Validation → Standing changes → Knowledge reorganizes → Reasoning changes
```

That is evolution, not evaluation. Its objective is no longer "does standing improve retrieval?" but the institute's deepest claim: **can validated experience reorganize a constitutional substrate into a better reasoning substrate — without losing integrity?**

The trap that forced the redesign (recorded per IRL Principle 004): standing is a pure function of `timesValidated` (`services/invariants/lifecycle.ts:computeStandingScore`), and the freshly-advanced crystal has `timesValidated = 0` everywhere → `standing = 0` uniformly. A "standing-weighted vs confidence-weighted" A/B under uniform standing tests *two labels for the same ordering* and yields a null by construction. Standing must be **earned** before the comparison means anything — and earning it *is* the flywheel. So the retrieval A/B is now one arm of a larger evolution study.

## The metaphor that governs the design

The crystal is not a library; it is a **living constitution**. It improves not by adding articles indiscriminately, but by its principles being interpreted, tested, challenged, amended, and accumulated through validated experience *while preserving continuity* (`inv.epistemology.132`; IRL-011 §4.5). Growth is not the mechanism of improvement — **reorganization through validated use** is.

## Two hypotheses, measured independently (IRL-011 §4.3)

- **H1 — standing changes.** The Account step actually moves standing (`Φ` is non-trivial): `Account → standing`.
- **H2 — standing improves retrieval.** The changed standing yields better curation: `standing → better K`.

`H1 ∧ ¬H2` is an informative, publishable outcome (the substrate reorganizes but the reorganization does not help — merit is mis-measured). The flywheel turns *productively* only if both hold.

## Non-negotiable design invariants

1. **Freeze before you measure.** `Φ` mutates the substrate, so every comparison runs against a **frozen, versioned crystal**, never a live one:
   ```
   Crystal v0 → Accrual → freeze → Crystal v1 → experiments
   ```
   A crystal version is a scientific artifact — analogous to a model checkpoint / database migration / software release, but for knowledge. Anyone can re-run against `Crystal vN`. (Mechanism: snapshot `(seed_id, times_validated, times_contradicted, standing, reach)` to a versioned record; experiments read the snapshot, not the live table.)
2. **Every standing increment is receipted.** Never a bare `standing++`. Each increment carries provenance:
   ```
   Invariant → validated-by Task → Judge verdict → Receipt → standing increment
   ```
   Standing without an auditable justification is opaque and forbidden — IRL Principle 004 (`inv.epistemology.131`) applied to the substrate itself. The accrual pass emits a `standing_increment` receipt (DVN-anchorable) per bump.
3. **H1 and H2 measured independently** (do not report one as the other).
4. **Reset is deterministic.** `UPDATE invariants SET times_validated=0, times_contradicted=0, standing=0, reach=0` (scoped) restores `Crystal v0`; the versioned snapshots make every state re-derivable.

## Arms

| Arm | Name | Tests | Deliverable |
|---|---|---|---|
| **EXP-006A** | Standing Accrual | H1, F-none (mechanism) | receipted accrual pass; `Crystal v1` frozen snapshot; before/after standing distribution |
| **EXP-006B** | Standing-weighted Retrieval | H2, P2, F7 | on frozen `Crystal v1`: standing-ordered vs confidence-ordered curation; economy + fidelity delta |
| **EXP-006C** | Convergence of Φ | C1, F6 | iterate `v1 → v2 → v3`; does the merit order converge? distance-to-fixpoint per iteration |
| **EXP-006D** | Cross-domain Transfer | P3 | standing earned on family T₁, tested on held-out family T₂ (the leakage-free generalization test) |
| **EXP-006E** | Crystal Version Comparison | versioned artifacts | does `Crystal vN` outperform `vN−1`? attribute gain to reorganization, not accumulation |

## Accrual mechanism (EXP-006A, specified)

Per grounded task run: obtain the answer under broad grounding; the judge scores each claim consistent / contradicting / outside against the slice; `countCitations` identifies which invariants were cited. Then, per cited invariant:
- cited in a majority-consistent answer → `Validate(I)` (`times_validated += 1`) + a `standing_increment` receipt naming (task, judge verdict, hash);
- cited in an answer with a contradiction it participates in → `Contradict(I)` (`times_contradicted += 1`) + receipt;
- recompute `standing`/`reach` via `computeStandingScore`/`computeReachScore` (unchanged formulas — tuned by canonization, not ad-hoc edit).

## Relationship to prior work

- Supersedes the "EXP-003 Run 002" framing. EXP-003 (Reasoning Economics) stands as the *static* baseline; its breadth arm (Run 001) is the first datum for `inv.epistemology.132` (curation dominates accumulation).
- The `E = f(G, B, M)` model (IRL-011 §6) isolates the variables EXP-006B/C manipulate: EXP-006 is where **M** (merit/standing) is finally given real variance.
- On success, EXP-006 is the empirical body that would move `inv.epistemology.132` from *governing principle* to *document-verified*, and would demote or confirm C1 (IRL-011 §4.2).

## Honest limits (carry into any result)

- Longitudinal ⇒ slow by design; not a light lift (the reason for deferral, recorded honestly).
- Small task corpora inflate in-distribution effects; EXP-006D exists precisely to separate transfer from leakage.
- Freezing/versioning + receipted accrual are build work (EXP-006A deliverables), not yet implemented — this is a charter, not a result.
- A null anywhere is publishable (Principle 004): `H1 ∧ ¬H2`, non-convergence (F6), or no-transfer (P3) each teach something real about the substrate.
