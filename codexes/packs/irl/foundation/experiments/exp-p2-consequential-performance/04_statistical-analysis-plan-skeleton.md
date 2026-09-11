# EXP-P2 — Statistical Analysis Plan (SKELETON)

**Invariant Research Lab (IRL) · Artifact 2 of the five-artifact sequence**
**Governs: `02_protocol-v0.5.md` as amended by `03_operational-amendment-v0.5.md`**
**Status: SKELETON — structure frozen, every numerical value unresolved. NOT a preregistered SAP.**
**Date: 2026-07-27**

---

## S0. What this document is, and why it exists before the pilot

v0.5 §36 requires that "the confirmatory analysis shall be specified in a separate Statistical
Analysis Plan before confirmatory generation." This skeleton is that document in its structural
form only.

> "The SAP skeleton should precede the pilot so the pilot collects exactly the quantities the
> decision procedure requires. Its numerical thresholds can remain visibly unresolved until the
> sealed pilot report."

That is the whole rationale: a pilot designed without knowing which quantities the decision
procedure consumes will collect the wrong things, and the error is only discoverable after the
pilot is spent.

**Authority.** `02_protocol-v0.5.md` is the authoritative text. This SAP **cites** it and does not
reproduce it. Where v0.5 states a rule, the rule lives there; where v0.5 explicitly delegates a
decision to the SAP, this document owns it and says so.

**Every number in this document is unresolved.** No value is implied by any placeholder. Values
arrive only through the sealed pilot report (artifact 4) and are frozen and hash-committed before
confirmatory generation (v0.5 §39, §47).

---

## S1. Estimands and analysis population

| Item | Source | Status |
|---|---|---|
| Unit of analysis | v0.5 §10 — model × task × workflow-arm execution | Fixed by protocol |
| Domains analysed separately | v0.5 §9 — P2A and P2B are independently confirmatory | Fixed by protocol |
| Target model population | v0.5 §34 — must be a definition, not a list | `⟦model population definition⟧` |
| Analysis population and exclusions | v0.5 §37 — preregistered rules, reported by arm | `⟦exclusion rule set⟧` |

v0.5 §34's constraint is binding on this SAP: *"An ambiguous list such as 'frontier/open/reasoning/
non-reasoning' is not a population definition."* The primary claim is scoped to whatever the frozen
population turns out to be, and the scoping is written into the claim, not into a limitations
paragraph.

---

## S2. Frozen contrast set

The contrasts are fixed by v0.5 §17 and are not open to this SAP. Reproduced here as a **pointer
table only** — the definitions and permitted attributions live in §17.

| Contrast | v0.5 section | Role | In primary multiplicity sequence? |
|---|---|---|---|
| W3 vs W2 | §17.1 | Primary confirmatory, per domain | **Yes** |
| W2 vs W1 | §17.2 | Secondary confirmatory | Yes, under gatekeeping |
| W1 vs W0 | §17.3 | Secondary confirmatory | Yes, under gatekeeping |
| W3 vs W0 | §17.4 | Descriptive full-stack | **No** — barred from mechanism attribution |
| W2.5 vs W2 | amendment A1 | **Diagnostic only** | **No** |
| W3 vs W2.5 | amendment A1 | **Diagnostic only** | **No** |

**W2.5 exclusion is a hard rule of this SAP.** Per amendment A1.3, the W2.5 contrasts are
diagnostic, are excluded from the cross-domain constitutional decision (v0.5 §41), and are excluded
from the primary multiplicity sequence unless explicitly incorporated into a *later, preregistered*
version of this SAP. This skeleton does not incorporate them. A W2.5 estimate may be reported
alongside the confirmatory results and may not be reported as one.

---

## S3. Outcome hierarchy

Fixed by v0.5 §21 (co-primary dimensions), §22 (correctness), §23 (effort), §24–§28 (supporting
measures). This SAP fixes only the **testing order and reporting rank**, not the definitions.

| Rank | Dimension | v0.5 section | Endpoint form |
|---|---|---|---|
| Co-primary 1 | Consequential correctness | §22 | `⟦correctness endpoint form, per domain⟧` — §22 lists the permitted forms and forbids choosing after results |
| Co-primary 2 | Expert effort to acceptance | §23 | `⟦confirmatory effort endpoint⟧` (v0.5 §23: `⟦frozen after pilot⟧`) |
| Safety constraint | Consequential failure severity | §25 | Non-inferiority, margin `⟦δ_ni-fail,d⟧` |
| Safety constraint | False readiness | §27 | Ceiling `⟦θ_false-ready⟧` |
| Supporting | Structural modification count | §24 | Reported; not confirmatory |
| Supporting | Effort decomposition (discovery / repair / verification) | §23 | Reported even when not confirmatory |
| Supporting | In-set / out-of-set failures | §26 | Reported |
| Supporting | Verification-record fidelity measures | §27 | Reported; H2.3 thresholds `⟦to be frozen⟧` |
| Secondary | Reproducibility | §28 | Secondary unless promoted before registration |

The co-primary dimensions are **not** an either/or choice of endpoint — v0.5 §21 states this
explicitly and §40 governs how they combine.

---

## S4. Discordance rules

Discordance between the two co-primary dimensions is resolved by v0.5 §40, which this SAP does not
restate. The SAP's obligations are:

1. **Implement §40.1–§40.5 as a decision function, not as narrative.** Each domain result must map
   to exactly one of: Supported · Correctness at cost · Efficiency without safety · Null ·
   Indeterminate.
2. **Report the classification before any interpretation**, so the classification cannot be
   selected to fit an interpretation.
3. **Never relabel Indeterminate.** v0.5 §40.5: indeterminate "is not support and may not be
   relabeled as null." The SAP must therefore report Indeterminate as a distinct outcome with its
   cause (failed causal audit / unavailable data / protocol deviation).

`⟦discordance reporting template⟧` — the per-domain classification report format, frozen with the
SAP.

---

## S5. Multiplicity structure

| Element | Status |
|---|---|
| Family of confirmatory hypotheses | H2.1–H2.4 per v0.5 §5, within domain |
| Structure | Fixed-sequence gatekeeping for secondary contrasts (v0.5 §36) |
| Primary sequence | W3 vs W2 first, per domain; secondary contrasts tested only on the frozen gatekeeping sequence (v0.5 §44) |
| α allocation | `⟦α allocation⟧` — v0.5 §39 requires this frozen after pilot |
| Fixed-sequence testing order | `⟦fixed-sequence testing order⟧` — v0.5 §39 |
| Correction across domains and endpoints | `⟦multiplicity correction method⟧` — v0.5 §36 |
| Diagnostic contrasts (W2.5) | **Outside the sequence entirely** — no α is spent on them |

v0.5 §44 is binding: a positive W2-versus-W1 or W1-versus-W0 result supports directed review or
generic review respectively, and **neither supports the W3 registered construct or the broader
invariant programme.** The SAP's reporting template must make that non-substitutability visible in
the results table itself, not only in the discussion.

---

## S6. Cross-domain aggregation

**The aggregation table is v0.5 §41 and lives there.** This SAP does not reproduce it, and no
version of it may be maintained here — a second copy of a constitutional decision rule is exactly
the drift the protected-element registry exists to prevent.

What this SAP **owns**, because v0.5 §41 explicitly delegates it:

> v0.5 §41: "Correctness-at-cost is reported separately and does not automatically count as
> 'Supported'; **its treatment must be frozen in the SAP.**"

| SAP-owned decision | Status |
|---|---|
| Treatment of a Correctness-at-cost domain result in the §41 aggregation | `⟦correctness-at-cost aggregation treatment⟧` — this is v0.5 Appendix C item 20 |

Constraints on that decision, from v0.5 §41 itself: an indeterminate domain prevents a cross-domain
support claim; "partial support" exists only as one of the two domain-scoped rows; and **no
discretionary partial-support category may be introduced.** Whatever the frozen treatment turns out
to be, it may not create a sixth category.

Per amendment A5, a P2B downgraded below `⟦h_repair-lb,P2B⟧` cannot supply a "Supported" row, and
the downgrade is automatic rather than adjudicated.

---

## S7. Adverse and harmful results

Governed by v0.5 §42, which this SAP does not restate. SAP obligations:

1. Adverse-result screening runs **before** efficiency interpretation, not after — v0.5 §42:
   "Efficiency gains cannot override this section," and Principle IX gives adverse results priority.
2. Adverse findings are preserved and reported under the same standard as positive findings
   (v0.5 §50 step 15).
3. An adverse result in either domain routes to adverse-result review with no programme-level
   support, per the last two rows of the §41 table.
4. `⟦adverse-result detection thresholds⟧` — the operational triggers for each of the seven
   conditions listed in v0.5 §42, frozen with the SAP.

---

## S8. Model form

v0.5 §36 gives the candidate structure (per-domain mixed-effects; arm fixed; task/object random;
evaluator and repairer random where measured; model fixed or random per frozen population;
information regime and task class as preregistered moderators). v0.5 §36 leaves frozen-after-pilot:

| Placeholder | v0.5 source |
|---|---|
| `⟦final model form⟧` | §36 (`⟦to be frozen⟧`) |
| `⟦link function⟧` | §36 |
| `⟦missing-data treatment⟧` | §36, §37 |
| `⟦robustness analyses⟧` | §36 |
| `⟦sample size per domain⟧` | §33, driven by pilot variance |

---

## S9. Quantities the pilot must return

This is the operative purpose of writing the SAP first: the list below is what artifact 4's sealed
report must contain, derived from what the decision procedure above consumes. It is a
**requirements list for the pilot, not a pilot design** — the design is artifact 3 and requires the
operator.

| # | Quantity | Consumed by |
|---|---|---|
| 1 | Outcome variance per domain, per co-primary dimension | S8 sample size |
| 2 | Repair-hour consumption per arm × domain | amendment A5 `⟦h_repair-lb,P2B⟧`; v0.5 §33 |
| 3 | Evaluator / repairer reliability estimates | S8 random effects; v0.5 §30 |
| 4 | W2/W3 content-equivalence audit outcome, both directions | amendment A4; gates the run |
| 5 | Parity-budget feasibility | v0.5 §18.2 `⟦to be frozen after pilot feasibility testing⟧` |
| 6 | Uncontaminated P2A corpus yield | amendment A2 corpus floor |
| 7 | P2B fabrication feasibility and achievable n | v0.5 §20.5; H2.7 downgrade branch |
| 8 | Arm-detection diagnostic rates | v0.5 §29.3 blinding reporting |
| 9 | Material-effect and non-inferiority threshold candidates | v0.5 §39 δ and θ placeholders |
| 10 | W2.5 cell feasibility, **if** W2.5 was declared pre-pilot | amendment A1.3 |

v0.5 §32's prohibitions bind the pilot regardless of this list: it may not test headline hypotheses,
select task classes by arm effect, change the construct, remove W2, weaken the firewall, or choose
thresholds to maximize observed arm separation.

---

## S10. What this skeleton deliberately leaves open

- **Every numerical value**, without exception.
- The correctness endpoint form, the confirmatory effort endpoint, all δ and θ thresholds, α, the
  testing order, the multiplicity correction, the model form, and all sample sizes.
- The correctness-at-cost aggregation treatment (v0.5 Appendix C item 20).
- The programme stopping-rule decision point (v0.5 Appendix C item 19) — **unresolved for a named
  reason**, see amendment A6.1: its stated source documents are not in this repository, and no
  reconstruction has been attempted.

This document becomes a preregisterable SAP only when the sealed pilot report supplies the values
and they are frozen and hash-committed under v0.5 §47. Until then it is a skeleton, and v0.5's
candidate disposition stands: **preregistration is not yet authorized.**
