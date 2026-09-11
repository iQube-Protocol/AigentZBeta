# EXP-P3 — Statistical Analysis Plan (SAP)

**Invariant Research Lab (IRL) · EXP-P3 — Representation of Structural Invariants**
**Version: 1.0 Candidate · Status: pending series ratification**

> Document 04 of the EXP-P3 set — the standalone Statistical Analysis Plan. It contains the
> confirmatory Decision Procedure (Section DP), moved here from the consolidated protocol with
> minimal editorial changes. ⟦ ⟧ marks parameters to be frozen before confirmatory runs.
> Section T (extraction gate, tier eligibility) and Section BP (content certification) are
> normative in RSS-001 (`03_RSS-001_representation-science-standard.md`) §2 and §3; section
> references of the form "§n" resolve to the EXP-P3 design body as noted in RSS-001's
> conventions block.

# Section DP — Confirmatory Decision Procedure

*(unifies success criteria and falsification into one tree)*

## DP.1 Registered parameters

Frozen before confirmatory runs, justified independently of arm outcomes, hash-committed:

- ⟦δ_mat⟧ — material effect threshold for structural-validity accuracy (candidate: ≥ 5 percentage points absolute, or a standardized effect justified from pilot variance);
- ⟦δ_eq⟧ — equivalence bounds for null/equivalence claims (TOST bounds);
- ⟦δ_ni⟧ — non-inferiority margin for contradiction rate (co-primary discordance rule);
- α = 0.05, family-wise, allocated per DP.3;
- the task-regime set (five regimes per §11) and per-regime minimum task counts;
- the model family set.

There is **no confirmatory global main effect of representation.** All confirmatory reasoning claims are per-regime or interaction claims. Any pooled summary uses preregistered regime weights with independently documented justification and is labeled descriptive.

## DP.2 Stage 0 — Prerequisites

Before any confirmatory test:

1. Content-mapping audit complete; assumption back-propagation applied; post-propagation equivalence certified; residual non-propagatable atoms excluded from scoring, with the exclusion list committed.
2. Back-translation audit passed at the preregistered threshold for every arm entering confirmatory analysis; per-substrate reconstruction difficulty reported as calibration data.
3. Extraction gate evaluated for all cells (Section T); Tier 2 eligibility map fixed and committed before unblinding of reasoning-task results.

Failure at Stage 0 for a given arm removes that arm from Tier 2 and routes it to Tier 1 reporting. It does not halt the experiment.

## DP.3 Stage 1 — Tier 1 confirmatory test

**Test 1.1:** omnibus test of substrate differences in extraction accuracy across eligible model families (mixed model; substrate fixed effect; model family and item random effects). α¹ = 0.05.
- If rejected: pairwise substrate access contrasts, Holm-corrected within the Tier 1 family. Access differences ≥ ⟦δ_acc⟧ are confirmatory Tier 1 findings.
- If not rejected and all pairwise TOST comparisons fall within ⟦δ_eq,acc⟧: confirmatory finding of *access equivalence* across substrates.
- Otherwise: access question indeterminate (reported as such; never described as "no difference").

Stage 1 outcomes do not gate Stage 2 statistically; they gate it only through cell eligibility (T.5).

## DP.4 Stage 2 — Tier 2 omnibus

**Test 2.1:** representation × task-regime interaction, plus representation effect within each regime, on structural-validity accuracy, estimated in a single preregistered mixed-effects model over eligible cells (fixed: substrate, regime, substrate × regime; random: model family, task item, generation; per §15, per-family estimates reported alongside).

The Stage 2 omnibus **passes** if the substrate × regime interaction or any within-regime substrate effect is significant at family-wise α² = 0.05 (single joint test or closed testing procedure; the specific procedure is fixed in the analysis plan before generation).

- **Omnibus fails and TOST confirms all within-regime effects inside ⟦δ_eq⟧:** proceed to DP.7 outcome N1 (supported null).
- **Omnibus fails without equivalence confirmation:** outcome N2 (indeterminate — insufficient precision; explicitly *not* a supported null and *not* suggestive support).
- **Omnibus passes:** proceed to Stage 3.

## DP.5 Stage 3 — Fixed-sequence named contrasts

Tested **only if Stage 2 passes**, in this fixed order, each at full α inherited under fixed-sequence gatekeeping (testing stops at the first non-rejection; later contrasts in the sequence then become exploratory):

1. **S vs L** — explicit serialized structure vs prose.
2. **M vs L** — formal-symbolic vs prose.
3. **S vs D** — serialized structure vs diagrammatic rendering.
4. **H vs best single arm** — hybrid complementarity, against the empirically best constituent, acknowledged as a conservative (max-of-estimates) comparison.

For each contrast, the confirmatory unit is the **per-regime effect**, Holm-corrected across the five regimes within that contrast. A contrast is **confirmed** if:

- at least one per-regime effect is significant with magnitude ≥ ⟦δ_mat⟧; and
- the direction replicates in every Tier 2–eligible model family for that regime (a reversal across families voids confirmation for that regime, per §15); and
- the **co-primary discordance rule** holds: contradiction rate for the favored substrate is non-inferior within ⟦δ_ni⟧ in the same regime. An accuracy gain accompanied by a contradiction-rate worsening beyond ⟦δ_ni⟧ is recorded as a *discordant result* — reported, but not confirmatory support for that substrate.

## DP.6 Confirmation criteria for H3.1

H3.1 (representation effect) is **supported** if and only if:

> Stage 2 passes, **and** at least the first contrast reached in the Stage 3 sequence is confirmed under DP.5, including the discordance rule.

A confirmed Tier 1 access effect alone supports the **access component** of computational non-equivalence and is reported as such; it does not substitute for DP.6 and may not be described as demonstrating a reasoning effect.

H3.2 (task-regime interaction) is supported by a significant substrate × regime interaction in Stage 2 with at least one regime-level effect ≥ ⟦δ_mat⟧ surviving DP.5's family-replication requirement.

H3.4 (hybrid complementarity) is supported only by confirmation of contrast 4 under the conservative standard, with content-map certification that H's advantage is not attributable to repeated presentation (§24).

## DP.7 Unified outcome interpretation table

Every confirmatory result pattern maps to exactly one row. No pattern may satisfy two rows.

| # | Pattern | Registered interpretation |
|---|---|---|
| P1 | Stage 2 passes; ≥1 Stage 3 contrast confirmed | Substrate is consequential for reasoning under tested architectures (H3.1 supported, scoped per DP.5) |
| P2 | Stage 1 confirms access differences; Stage 2 fails or is ineligible for the affected substrate | Substrate is consequential via **access**, not (demonstrated) via reasoning-given-access |
| P3 | Stage 2 passes; no Stage 3 contrast confirmed | Diffuse interaction without a confirmable named contrast — H3.1 indeterminate; named-contrast hypotheses unsupported; findings exploratory |
| P4 | Stage 2 passes; contrast confirmed on accuracy but discordant on contradictions | Substrate trades accuracy against consistency; no substrate endorsement; reported as discordant |
| N1 | Stage 2 fails; TOST confirms equivalence; Stage 1 confirms access equivalence | **Supported null:** informationally equivalent substrates were computationally equivalent under tested architectures; per §1, the empirical basis for a representation-search programme is not established by P3 |
| N2 | Stage 2 fails; equivalence not confirmed | Indeterminate — no claim in either direction |
| F1 | Any apparent effect fully attributable, on audit, to residual content inequivalence (post-propagation), gate leakage, or unblinding | H3.1 unsupported; the audit failure is reported as a methods finding |

## DP.8 Falsification conditions (restated within the tree)

The substrate-effect claim is **unsupported** under N1; **indeterminate** under N2 and P3; and **procedurally voided** under F1. Additionally:

- effects observed only in cells that failed or skirted the extraction gate support no claim in either direction;
- effects reversing across model families are not confirmable (DP.5) and are reported as architecture-dependent;
- effects attributable to a single task regime are confirmable **as regime-scoped claims only** — the report must not generalize them across regimes;
- pre-pilot (S vs L) results are calibration only and enter no cell of DP.7.

## DP.9 Amendment rule

After the first confirmatory generation, no parameter in DP.1, no gate threshold in T.4, no eligibility rule in T.5, and no row of DP.7 may be modified. Any analysis outside this section is exploratory and must be labeled as such in all reporting.
