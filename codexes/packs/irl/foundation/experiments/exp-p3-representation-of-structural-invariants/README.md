# EXP-P3 — Representation of Structural Invariants (documentation set)

**Invariant Research Lab (IRL) · Validation Programme series (P1 / P2 / P3)**
**Experiment ID: IRL-EXP-P3 · Version: 1.0 Candidate**
**Status: v1.0 Candidate — pending series ratification (protocol for external scientific review)**

This directory is the canonical EXP-P3 documentation set, assembled per the governing
Implementation Brief (Part D of the staging source
`foundation/experiments/_source/2026-07-26_exp-p3-spec-record-implbrief_source.md`) from the
operator-supplied sources of 2026-07-26. The assembly is an editorial and architectural
refactoring: the scientific content is preserved materially unchanged; the four normative BP
amendments are merged (Amendment 2 replaces BP.3 Step 6).

## Designation note — read before citing "EXP-P3"

The designation **EXP-P3** was previously used for a different design: Capability Validation
(`foundation/experiments/exp-p3-capability-validation/`, the D1 Consequence Engineering demonstration
slate). This documentation set is a **different experiment** — Representation of Structural
Invariants — staged as the P3 slot of the P1/P2/P3 series ratification packet
(`foundation/experiments/SERIES-RATIFICATION_p1-p2-p3.md`). **The designation conflict is unresolved
and is flagged for operator decision in the ratification packet.** Do not cite either as "the"
EXP-P3 without qualifying which design is meant.

## The document set

| # | Document | Purpose | Audience |
|---|---|---|---|
| 01 | [`01_experimental-brief.md`](01_experimental-brief.md) | High-level scientific overview — no implementation detail | External reviewers |
| 02 | [`02_experimental-protocol.md`](02_experimental-protocol.md) | The constitutional protocol — what this experiment *is*, incl. the eight Constitutional Principles | Reviewers, preregistration |
| 03 | [`03_RSS-001_representation-science-standard.md`](03_RSS-001_representation-science-standard.md) | **RSS-001** — the reusable Representation Science Standard: certification, tiered equivalence (Section T), assumption back-propagation + canonical closure (Section BP, amendments merged), visual notation (Section VN), audit framework, governance. **Reusable by future experiments; not P3-only.** | Any experiment comparing representations |
| 04 | [`04_statistical-analysis-plan.md`](04_statistical-analysis-plan.md) | Statistical Analysis Plan — the confirmatory Decision Procedure (Section DP), standalone | Analysts, preregistration |
| 05 | [`05_implementation-guide.md`](05_implementation-guide.md) | Laboratory manual — arms, task corpus, ground truth, schemas, models, workflow, commitments | Execution team |
| 06 | [`06_internal-research-record.md`](06_internal-research-record.md) | Design history and provenance (IRL-EXP-P3-RR-001), incl. retained reviewer drafting notes | Internal / historical record |

Reading order for an external reviewer: 01 → 02 → 04 → 03. The Implementation Guide (05) and
Research Record (06) are not required for scientific review.

## Epistemic status

Hypotheses H3.1–H3.4 are empirical hypotheses under test. Per the IRL Hypothesis vs Canon
discipline they enter and remain `proposed` until the experiment produces supporting evidence.
The experiment is designed so that supported nulls are meaningful outcomes (02 §12); no P3 claim
may be stated as established fact before the registered decision procedure (04) has run.

## Sources (verbatim provenance, staged 2026-07-26)

- `_source/2026-07-26_exp-p3-briefs_source.md` — v0.2 full design + v1.0 Candidate brief
- `_source/2026-07-26_exp-p3-sections-T-DP_source.md` — Section T + Section DP
- `_source/2026-07-26_exp-p3-section-BP_source.md` — Section BP + four normative amendments
- `_source/2026-07-26_exp-p3-section-VN_source.md` — Section VN
- `_source/2026-07-26_exp-p3-spec-record-implbrief_source.md` — Spec v1.0 Candidate, protocol outline + Constitutional Principles, Internal Research Record, Implementation Brief (governing)
