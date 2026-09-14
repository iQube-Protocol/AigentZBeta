# Threshold 007 — Longitudinal Evidence Bundle v1.1 Addendum

**Status:** Addendum to the FROZEN `2026-09-13_threshold-007-longitudinal-evidence-bundle-v1.0.md` (bundle ID `TB007-LEB-v1.0-20260913`, frozen at commit `cdcec90aa7e62550e44eda20802f873452f287eb`). Per that bundle's own freeze statement, "any material change to the referenced evidence-resolution documents after this freeze requires a new evidence-bundle version (v1.1+), not a silent edit to this file" — this addendum is that new version. v1.0 is untouched.

## What this adds

An independent external adversarial review has been produced and is now folded into the evidence corpus by reference (per operator direction — the review's own author had recommended keeping it as a standalone, non-evidence-record file to preserve its independence as an external check; the operator has since confirmed it may also be referenced from/folded into the evidence corpus, which this addendum does without altering the review file itself or the frozen v1.0 bundle):

| Artifact | Path | SHA-256 | Size |
|---|---|---|---|
| Invariant Intelligence — Merit-to-Falsify Review | `codexes/packs/agentiq/reviews/2026-09-14_invariant-intelligence-merit-to-falsify-review.md` | `f90e6a367ddd903487835c49fecd2c39dc405e20e11c191c58226dbcff2f61f8` | 25,138 bytes |

**Provenance:** authored by an independent adversarial-review agent external to this session, with no push/commit credentials of its own to this repository (confirmed by that agent via a failed authenticated API test, disclosed rather than worked around). This session verified the file byte-for-byte against the agent's independently-computed hash before committing it — the hash matches exactly, both before and after commit. The reviewing agent has been given the resulting commit SHA to independently re-fetch and re-confirm, per its own requested verification protocol (the same method used earlier in this evidence-resolution effort, run in the opposite direction).

**Where it lives, and why that location:** committed to `codexes/packs/agentiq/reviews/` — a new directory, separate from `codexes/packs/agentiq/updates/` (the Evidence Agent's own evidence-resolution record), with its own `README.md` explaining the distinction. This preserves the reviewer's own reasoning (an external adversarial check has more value when it is visibly not produced by, or folded into, the same corpus it reviews) while still being indexed and citable from the evidence bundle, satisfying the operator's direction that it may also be connected to the evidence corpus.

**Content, not reproduced here (see the file itself):** a conceptual/philosophical merit-to-falsify review of Threshold 007, evidentiary/readiness questions explicitly bracketed out of scope by the reviewer's own method. Final disposition (§19 of the review): **"THESIS — MERITS FALSIFICATION PROGRAMME"**. The review identifies the false-invariance problem (§11) as "the single most dangerous unaddressed theoretical gap in the framework" and proposes three concrete falsification experiments (§20): an information-matched frontier test (direct kill-shot for H1b), a preregistered multi-domain factorial ablation (kill-shot for H4), and a false-invariance drift/adversarial stress test.

**Evidentiary status of this review, for the Longitudinal Adversary:** this is a *conceptual* review, not new primary-source evidence about what exists/is implemented/has been observed in this codebase — it does not change any status field in the frozen v1.0 bundle's claim-change ledger, Consequence Horizon table, or machine-readable receipt. It is best read as a second, independently-produced adversarial perspective the Longitudinal Adversary may weigh alongside the evidence substrate, not as evidence itself. This addendum does not merge its findings into, or treat it as authoritative over, any status classification in v1.0.

## Freeze

This addendum is itself frozen once committed; the SHA-256 of this file and the commit introducing it are the identifying anchors for this specific addition, resolvable the same way as v1.0 (`git show <commit>:<path> | sha256sum`).
