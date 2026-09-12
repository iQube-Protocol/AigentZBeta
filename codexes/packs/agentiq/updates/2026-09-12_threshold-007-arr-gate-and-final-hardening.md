# Threshold 007 — ARR Gate Established, Final Hardening Pass

**Status:** Shipped. Establishes the Adversarial Research Review Gate (ARR Gate) as a permanent,
repo-wide publication process, and applies its findings to harden Threshold 007 ("Invariant
Intelligence") before its final publication.

## What happened

A separate Claude agent, acting as an adversarial reader of Threshold 007's already
citation-hardened draft, reviewed it end-to-end and reported real gaps without the paper's central
thesis collapsing: a namespace collision between two systems both called "Aegis" (a doctrine-level
research programme and `services/aegis/aegisAssessmentService.ts`, an operational implementation),
framing drift between two experiment sections' essay-level summaries and their own registered
protocols' stated scope (EXP-P1, EXP-P2), and seven internal citations (`IRL-010`, `IRL-010A`, `[CI]`,
`[PE]`, the Aegis doctrine, the Aegis Crucible charter, the Golden Cycle thesis) that resolve to
nothing in either this repository or the Supabase content database.

**007 got stronger by discovering evidence against its own presentation, not by accumulating more
supportive citations.** That is the behavior this update makes a standing publication invariant
rather than treating it as a one-time virtue of one paper.

## The ARR Gate

Two new canonical artifacts:

- `docs/research/adversarial-research-review-gate.md` — the full procedure: the evidence firewall,
  independence rule, five mandatory passes (claim / citation / implementation / experiment /
  falsification audits), the naming-collision rule, frozen-protocol supremacy, unresolved-reference
  handling, machine-readable gap disclosure, the four dispositions, and the ARR receipt schema.
- A mandatory summary section appended to both `AGENTS.md` and `CLAUDE.md` under
  `## Adversarial Research Review Gate — MANDATORY BEFORE RESEARCH PUBLICATION`, pointing to the doc
  above as canonical so the review protocol can evolve without duplicating procedure text in two
  agent-contract files.

Two principles anchor the gate, stated in the doc itself: consistency is not verification (an
internally agreeing canon can rest on one unchecked claim wearing three hats), and convergence
requires independent provenance (doctrine + database + code agreeing is strong
implementation-consistency evidence, not automatically strong scientific evidence, unless the
converging artifacts could have failed independently).

## What changed in the 007 manuscript itself

All six items of the final hardening pass, applied to `docs/qriptopian/thresholds/007-research-edition.md`:

1. **Unresolved references quarantined, machine-readably.** The seven references already marked
   `UNRESOLVED` from prior work now carry an explicit statement that none is load-bearing and none
   inherits status from a neighboring resolved citation, plus a machine-readable JSON block listing
   all seven with `status: "UNRESOLVED"` and `loadBearing: false`.
2. **Aegis disambiguated everywhere it appears.** Every reference to "Aegis" in the paper (the
   abstract, §16's heading and prose, §16's implementation citation II007-IA11, the Instrument Panel
   in §27, the Argument-to-Evidence Graph's H3a entry, the Implementation-Evidence Register, and the
   closing Crucible-instruments sentence) now names which Aegis — the doctrine-level "Aegis —
   Constitutional Admission and Calibration Doctrine 0.0" or the operational "Factor Aegis"
   (`services/aegis/aegisAssessmentService.ts`) — and states explicitly that neither may stand in as
   evidence for the other.
3. **EXP-P1 (§6) and EXP-P2 (§18) restructured so the registered protocol's own framing is primary.**
   Both sections now open with the protocol's own text (EXP-P1's arm-delta table and explicit
   disclaimer that it does not test the Layer-1-vs-Layer-2 question; EXP-P2's §3 primary scientific
   question) as the authoritative description, with this paper's earlier broader summary retained
   only as a labeled, explicitly non-authoritative "editorial gloss" demonstrating the exact framing
   drift the ARR Gate exists to catch.
4. **Machine-readable `directExperiment` markers added** to all four hypothesis entries in the
   Argument-to-Evidence Graph (§28): H1 → `"EXP-P1"` with its arm-delta scope; H2 → `null`; H3a →
   `null` with `EXP-P2` listed only as adjacent; H3b → `null`. A null field discloses a gap; an
   absent field would have silently omitted the question.
5. **Schema-enforced separation between implementation convergence and scientific evidence**, added
   near the Citation Integrity Disclosure: a JSON block naming the seven evidence classes and stating
   that an entry's class is fixed at authoring time — implementation convergence across doctrine,
   database and code is never promotable to scientific/IRL evidence by prose association or
   aggregation alone.
6. **An ARR Receipt section added** to the manuscript, pointing to this update doc and to the
   content row's `ai_metadata.arrReceipt` field as the canonical location of the full receipt.

Two new limitations principles were added to §31 (Limitations), in the neutral phrasing the operator
specified: that a trustworthy research system should be optimized to discover when its own
consistency rests on an unchecked claim, and that convergence increases confidence only when the
converging evidence has sufficiently independent provenance.

## The ARR receipt

- **Paper/content ID:** Threshold 007, `docs/qriptopian/thresholds/007-research-edition.md` (Qriptopian
  Threshold Research Edition; Supabase content row content ID to be confirmed at publication).
- **Reviewed commit:** hardening changes committed on `claude/zealous-mendel-afqe89`; permalinks in
  the manuscript are pinned to `3ab092623e20a11160aed8193aac181a72c6757f` for prior implementation
  citations, carried forward unchanged by this pass.
- **Reviewer identity/class:** independent Claude agent session (Agent tool, `general-purpose`
  subagent), invoked with no authoring context for this paper, instructed to review through the
  repository's own files as an outside reader would.
- **Disposition:** the review's **first pass returned `REVISION_REQUIRED`**, on one material finding
  (below); after the correction it applies to, the manuscript now states as **`PASS_WITH_DISCLOSED_GAPS`**,
  not yet independently re-reviewed by a second pass (per the ARR Gate's own rule, a full re-review is
  not required when the correction is narrow and does not touch other claims — this correction was
  exactly that: one section's cross-reference and two new JSON gap markers).
- **Findings, correction made, and remaining disclosed limitations:** below.

**Reviewer's material finding (verbatim disposition: REVISION_REQUIRED):** the independent review
verified that all 19 cited implementation paths resolve at the pinned commit, that the seven
unresolved references are honestly disclosed and non-load-bearing, and that every "Aegis" occurrence
now disambiguates correctly — but it surfaced a **second naming collision the hardening pass had
missed**: EXP-P1's own README (§14) charters IRL's Layer-1-vs-Layer-2 structural hypothesis as a
*separate* experiment, also called **EXP-P2**, at a path (`exp-p2-structural-invariance/`) that was
**never instantiated** in this repository. The "EXP-P2" this paper's §18 actually cites
(`exp-p2-consequential-performance/`) is a different, later-registered protocol under the same ID —
its own text records that it was "recentered on process," explicitly superseding the earlier
structural-substrate framing. The manuscript's §6 (pre-correction) asserted the Layer-1-vs-Layer-2
question "is EXP-P2's scope (§18)" — false under frozen-protocol supremacy, since §18's EXP-P2 is not
that experiment.

**Correction made in response:** §6 now discloses this as a second, explicit naming collision (an
experiment ID reused across the P-series, analogous to the Aegis collision) and states the resulting
gap machine-readably (`directExperiment: null` for the Layer-1-vs-Layer-2 sub-claim, both in §6 and
in the H1 entry of the Argument-to-Evidence Graph, §28). §18 now carries a matching naming-caution
paragraph pointing back to §6. No claim was removed or weakened beyond correcting the false
cross-reference — the gap this correction discloses was already implicit in the fact that no such
protocol exists; it is now stated rather than papered over by an incorrect citation.

**Remaining disclosed gaps, confirmed by the review:** H2 and H3b have no direct registered
experiment; EXP-P1 and EXP-P2 each test only their own bounded arm-specific/primary-question claims,
not H1 or H3a in fully general form; and now, additionally, no registered protocol currently tests
H1's original Layer-1-vs-Layer-2 sub-question. These are real, open scientific gaps — disclosure, not
closure, is what this hardening pass achieves, which is exactly what the ARR Gate asks a review to
certify.

## Why this matters

The operator's framing, preserved here as the meta-lesson: "the thing worth being encouraged by is
not that Claude likes the thesis. It is that increased scrutiny is currently reducing unsupported
certainty rather than producing defensive rationalization. That is exactly the behavior we need to
institutionalize before the research corpus gets substantially larger." The ARR Gate is that
institutionalization — a standing, independent-reviewer, five-pass, receipted process, not a one-time
courtesy pass on one paper.
