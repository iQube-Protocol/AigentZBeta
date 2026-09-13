# Threshold 007 — Candidate Research Proposition: Constitutional Robustness Under Deceptive Cognition

**Status: PROPOSED. Not canonical. Not evidence. Not a finding of the Evidence-Resolution Pass.**

This document exists to keep a distinction the operator explicitly required: the Evidence Agent's evidence-resolution work (`2026-09-13_threshold-007-evidence-resolution-pass.md` and its `v1.1-addendum.md`) establishes what exists, what it measures, and how artifacts relate. It does not adjudicate open research questions. The proposition below is a candidate hypothesis for the Longitudinal Adversary to attack — it must not be read into, or treated as supported by, the evidence-resolution record.

## The proposition, as given by the operator (verbatim)

> **Constitutional robustness under deceptive cognition:** Constitutional Computing does not require governance of cognition or reliable inference of benevolent intent as its primary safety boundary. Its research object is exercised agency. A candidate hypothesis is therefore that a sufficiently effective constitutional computational order can constrain consequential machine action within admissible bounds despite variance — including deception — in an actor's internal objectives. Deception should consequently be treated as an adversarial condition against which constitutional action boundaries may be tested, rather than assumed to be solved by consequence measurement itself.

## Why this is not (yet) an evidence-resolution finding

The Evidence-Resolution Pass v1.1 addendum's §O locates real primary-source doctrine establishing that this codebase's "constitutional computing" is defined and, per real implementation (`services/access/evaluateAccess.ts`, DVN anchoring allowlists, Factor authority-chain revocation), operates as enforcement **at the point of action** — gate, refuse, require-proof, receipt, escalate — rather than as an intervention on an actor's internal reasoning or intent. That finding is about **what the doctrine says constitutional computing does** and **what the code actually implements**. It is real and primary-source-verified.

The proposition above goes further: it claims that this action-layer enforcement design is **sufficient** to constrain a *deceptive* actor's consequential action within admissible bounds. That is a much stronger, empirically untested claim. Nothing in this codebase has been shown to test an actor with variant/deceptive internal objectives against the constitutional gates — every gate-enforcement mechanism found in the evidence sweep (access evaluation, DVN allowlisting, authority-chain revocation) has been exercised only under the assumption of a cooperative or at least non-adversarial caller. No adversarial-actor experiment exists in the codebase's experiment registry today (per the same sweep that resolved RoR/PoTS/Golden Cycle/Vela-Horizon status).

Threshold 007's own Alternative Explanation 4 register (`docs/qriptopian/thresholds/007-research-edition.md:1084`) is the closest existing adjacent falsification-test framing ("Constitutional mechanisms improve safety or permission but not reasoning"), but it does not test deception specifically, and passing or failing it neither confirms nor refutes this proposition.

## Required adversarial treatment before any canonization

Per CLAUDE.md's Hypothesis vs. Canon discipline and the Adversarial Research Review gate: this proposition must remain at `proposed` status. It should not be canonized, and no prose anywhere in this codebase should state it as an established finding, until:

1. A registered, falsifiable experiment protocol exists that specifically constructs or simulates an actor with variant/deceptive internal objectives operating against real constitutional gates (not merely a cooperative-actor exercise of those gates).
2. The protocol's disconfirmation condition is stated explicitly (what result would show constitutional enforcement is *not* robust to deception).
3. An adversarial reviewer (per the Adversarial Research Review gate) has audited the claim, citation, and experiment/protocol chain independently of whoever proposed it.

## Disposition

- **Evidentiary status:** HYPOTHESIZED / PROJECTED. No implementation, instrumentation, or experiment in this codebase currently tests it.
- **Relationship to §O of the v1.1 addendum:** consistent with, but not established by, the "enforcement acts on action, not reasoning" doctrine finding — that finding describes design intent and real gate implementations; it does not demonstrate robustness against a deceptive actor.
- **Recommended next step:** capture as a `research_candidate_experiments` row (done — see `threshold-007-constitutional-robustness-under-deception`) for the Longitudinal Adversary and any subsequent EXP-series design work. Do not fold into 007.2 or the Evidence-Resolution Pass.
