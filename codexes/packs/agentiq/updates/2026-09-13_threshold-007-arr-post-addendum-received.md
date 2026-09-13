# Threshold 007 — Post-ARR Addendum Received (Pending SHA Reconciliation)

**Date:** 2026-09-13
**Status:** Received and preserved verbatim. NOT yet applied to `content_publication_gates` —
see the reconciliation gap below.

## Provenance

This addendum was relayed by the operator in two passes. The first pass asserted specific findings
without a verifiable artifact and was not acted on (see
`2026-09-13_threshold-007-arr-factual-corrections-handoff.md` for the Evidence Agent's response at
that point). The second pass, preserved in full below, is materially more careful: it discloses its
own scope limitations explicitly, including that it reviewed a specific candidate SHA and did not
re-query the live gate row. That self-disclosed rigor is itself evidence of a genuine independent
review process, as distinct from a restatement.

## The one open reconciliation item: candidate SHA

The addendum's own machine-readable receipt states:

```
reviewed_candidate_sha: 824dd19db8e08d6072b3d8b7846e71ab89bf414165dfd27fae44a249b7bac36a
```

The live candidate, as of this Evidence Agent's last sync (2026-09-13, commit `d8c226824`), is:

```
candidate_text_sha256: 6648f21f308e7395cba0c8d85bf48978f94b27d6f014f11f2ffa5c96ff2f3895
```

The diff between these two states is exactly the myGuard/OpenClaw capability-vs-constitutional
reclassification, the frozen genealogy chain (with Law retained), and the abstract's
"nascent-but-not-pre-experimental" correction — all of which are consistent with, and largely already
enact, what this addendum itself recommends. Nothing in that diff appears to contradict any finding
below. But per this paper's own frozen-protocol-supremacy and no-self-certification discipline, an
Evidence Agent may not assume that equivalence on its own authority — an independent reviewer must
confirm it, or review the current SHA directly.

## The addendum, preserved verbatim

> None of EXP-001/002/003/P1's rehearsals can substitute for a registered, matched-baseline test of
> CH_Invariant > CH_Baseline. This is stated plainly, matching the original ARR's own discipline.
>
> **6. Domain/genealogy reconciliation**
>
> Confirmed dated sequence (all independently verified against primary commits/files, not taken from
> the Operator's or the manuscript's own restatement):
>
> 1. 2026-07-03 — Foundational media/invariance experiments (EXP-001/002) authored.
> 2. 2026-07-04 — Consequence Engineering grounded in Law XV/CFS-006a §7; EXP-003 executed same day.
> 3. 2026-07-16 — Structural/constitutional invariance disentangled in one dated event (EXP-010
>    Phase-1 freeze).
> 4. 2026-07-18 — Cross-domain P1–P3 Validation Programme chartered; finance present as D4, one of
>    six staged candidates, D1 (Consequence Engineering) run first.
> 5. 2026-09-09 through ~09-12 — Golden Cycle/Vela/MoneyPenny financial-services consolidation, ~8
>    weeks after the charter.
>
> Cross-domain provenance is not cross-domain validation. The charter's breadth shows the research
> programme's cross-domain intent is genuine and dated, not retrofitted. It does not show that any
> structure has actually transferred across domains — no such result exists.
>
> **7. Publication-blocker reassessment**
>
> I re-examined the actual constitutional rule the manuscript's own gate mechanism enforces
> (`threshold_research_gate_is_publishable`, verified directly against the migration SQL in the
> original ARR): the check requires `gate_status = 'approved' AND evidence_resolved = true AND
> no_evidence_regression = true AND arr_disposition IN ('PASS','PASS_WITH_DISCLOSED_GAPS')`. It does
> not condition on any evidentiary-maturity level (B vs. C) and does not reference title wording. On
> reassessment:
>
> - Original blocker 1 (zero core-hypothesis execution) is downgraded from a publication blocker to a
>   disclosed research-maturity limitation. The lack of H1b/H2/H3d/H4 validation is real and caps the
>   maturity rating at B (§8) — but the publication constitution itself does not require Level-C
>   validation before an ARR disposition of `PASS_WITH_DISCLOSED_GAPS` may stand, and that disposition
>   explicitly exists for exactly this situation: a manuscript presenting itself as a falsifiable
>   research programme rather than an established result. My original framing conflated "the thesis is
>   not scientifically established" with "the thesis may not be published as a falsifiable research
>   programme" — those are different claims, and only the first is true here.
> - Original blocker 2 (title/subtitle) is downgraded to a recommended-but-not-required clarification.
>   "A Falsifiable Path to Trusted Superintelligence," read grammatically, characterizes the path as
>   falsifiable — a claim about the research program's structure, not a claim that the path has been
>   empirically traversed. The abstract already contains the operative hedge ("The strongest claim of
>   this paper is therefore not that invariants have already been shown to produce
>   superintelligence... it is that a falsifiable research programme can be constructed"). I recommend
>   foregrounding that sentence earlier for a skimming reader, but I do not find a constitutional or
>   evidentiary basis to require it as a precondition for the current ARR disposition.
>
> Publication blockers before this addendum: 2. Publication blockers after: 0.
>
> **8. B→C maturity reassessment**
>
> - Present evidentiary maturity: B (unchanged). The new evidence enriches and corrects the factual
>   record of what has been executed, and shows the research programme is genuinely, dateably
>   empirical rather than purely conceptual — but none of it touches H1b, H3d, or H4, which remain the
>   load-bearing gates for Level C under the manuscript's own promotion criteria.
> - Conceptual/research ceiling: C (unchanged). Nothing in the new evidence changes the argument for
>   or against the conceptual distinctiveness of the H1a/H1b split or the Consequence Horizon
>   formulation.
>
> I am not promoting the paper because preliminary or instrument-validation experiments now exist; I
> am stating, more accurately than the original ARR did, that the programme has entered empirical
> investigation for its earliest and narrowest claims, while its central and most ambitious claims
> remain exactly as untested as before.
>
> **9. Revised publication recommendation**
>
> `PASS_WITH_DISCLOSED_GAPS` stands, unchanged as the disposition — now on firmer and more precisely
> reasoned ground than the original ARR, which held two items as hard blockers that a closer reading
> of the manuscript's own gate rule does not support as blockers. Threshold 007.2 is constitutionally
> eligible to proceed to the Publication Gate on the ARR-disposition axis. Whether it is actually
> promoted remains a decision reserved to the Publication Gate role and depends on the gate row's
> other live fields (`gate_status`, `evidence_resolved`, `no_evidence_regression`), which I have not
> queried live in this addendum either — I verified the schema and the rule, not the current row.
>
> **10. Machine-readable addendum receipt**
>
> ```yaml
> reviewed_candidate_sha: 824dd19db8e08d6072b3d8b7846e71ab89bf414165dfd27fae44a249b7bac36a
> original_arr_disposition: PASS_WITH_DISCLOSED_GAPS
> addendum_timestamp: 2026-09-13T00:00:00Z
> reviewer_role: The Adversary
> new_evidence_items_count: 6 (A-F independently verified; G explicitly not pursued per instruction)
> original_findings_corrected_count: 5
> original_findings_unchanged_count: 10
> publication_blockers_before: 2
> publication_blockers_after: 0
> disclosed_research_gaps_count: 7
> evidentiary_maturity_before: B
> evidentiary_maturity_after: B
> conceptual_ceiling_before: C
> conceptual_ceiling_after: C
> revised_arr_disposition: PASS_WITH_DISCLOSED_GAPS
> publication_recommendation: eligible_to_proceed_to_publication_gate; title/abstract-ordering clarification recommended, not required
> scope_limitations:
>   - OpenClaw genealogy (item G) not independently pursued, per instruction; remains UNRESOLVED / NON-LOAD-BEARING on the Operator's characterization alone
>   - Austin's actual countersignature / confirmatory EXP-P1 execution not confirmed as completed as of the last commit inspected (2026-09-12); access-control machinery for his review role confirmed shipped, the review act itself not confirmed
>   - EXP-P2/EXP-P3 folder-naming discrepancy between the July-18 charter and the manuscript's own later evidence register noticed but not reconciled — out of this addendum's scope
>   - Live Supabase publication-gate row not re-queried; only the gate function's SQL rule was verified
>   - No research.read grant into the private IRL corpus; all new evidence came from the public repository (patches, tarball snapshots, resolution records) rather than IRL's own internal document store
> ```
>
> **Final decision**
>
> A. Does `PASS_WITH_DISCLOSED_GAPS` still stand? Yes.
> B. How many genuine publication blockers remain? Zero. Both items the original ARR held as blockers
>    are, on closer reading of the manuscript's own gate rule, disclosed research-maturity limitations
>    (for the zero-core-execution point) and a recommended stylistic clarification (for the title), not
>    constitutional obstacles to the disposition already reached.
> C. Is Threshold 007.2 constitutionally eligible to proceed to Publication Gate? Yes, on the
>    ARR-disposition axis. This is not a statement that the Publication Gate will or should promote it
>    — that determination is the Gate's alone, and depends on gate-row fields I have not live-queried.
> D. Conditions before the Gate may promote it: None are strictly required by the ARR disposition
>    itself. Recommended, not required: foreground the abstract's existing "not already shown to
>    produce superintelligence" disclaimer earlier, ahead of or alongside the title, for a skimming
>    reader.
> E. Publication conditions vs. future B→C research requirements: Publication conditions = none beyond
>    the recommendation above. B→C research requirements = unchanged from the original ARR in full: a
>    matched-baseline H1b result; a tacit-capability-discovery result with successful transfer
>    prediction; a replicated, preregistered non-additive H4 interaction across at least two materially
>    different domains; a cross-domain consequence-transfer result; head-to-head rejection of the
>    retrieval/library-learning/priors alternatives on the same task set; and independent replication
>    by a party outside the Operator–Aletheon dyad — of which the still-unconfirmed Austin
>    countersignature on EXP-P1 is the one concrete, currently-pending instance.

## What remains before this can be applied

This Evidence Agent role cannot itself certify that the above still holds against the current
candidate (`6648f21f...`) — that requires either the reviewer confirming it directly against the
current commit, or the reviewer writing the addendum as a database record the way the original
Supabase Evidence Handoff was written (independently verifiable, not relayed through the same
authoring context that drafted the manuscript). Once either exists, `arr_disposition`,
`gate_status`, and the deterministic Publication Gate check can be applied and reported.
