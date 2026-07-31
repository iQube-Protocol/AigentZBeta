# EXP-P1 Reviewer Package — Cover Note (Austin)

<!-- The sendable note is the text between the two horizontal rules below. Everything under "Internal — not for send" is repo-only context and must not be included when sending. -->

---

Hi Austin,

Stage-0 validation of the Invariant Resolution Engine (IRE) and Invariant Projection Validation (IPV) instruments is now complete.

I'm sending over the EXP-P1 protocol package and Stage-0 handoff record for your independent review and, if you are satisfied with the methodology, countersignature of EXP-P1 §15.

The purpose of Stage-0 was not to claim invariant resolution quality as a scientific result. Rather, it validated the experimental substrate:

* the IRE behaves as a deterministic instrument;
* the IPV projection is reproducible under repeated execution — **on the standing path and the seed set only; see the correction notice below**;
* the measurement methodology has been tested against confounds and adjusted before freezing;
* the remaining metrics are interpreted according to their role as proxies rather than absolute quality measures.

> ### ⚠ HOLD — do not send in this form. Correction pending (operator ruling, 2026-07-27).
>
> A units defect in the coordinate calibration (IRE-6) was found and corrected on 2026-07-27:
> `evidenceDensity` was clamped rather than converted from a 0–100 column, so it read 1.0 for every
> invariant with standing ≥ 1. **The coordinate-weight reproducibility figure quoted below is
> therefore a *pre-fix diagnostic; invalid for confirmatory comparison and not numerically
> comparable with post-fix runs*.** Worse than mis-scaled: with the coordinate vector reduced to a
> presence indicator, that metric duplicated the seed-set stability reported beside it and could not
> have failed.
>
> The IRE stability and coverage/compression/novelty figures are **unaffected** and may be sent as
> they stand. Stage 0 must be rerun from a frozen configuration before the coordinate claim is made
> to a reviewer. Telling a reviewer we found this ourselves, before they did, is the stronger note.

The final record results:

* IRE stability: 1.0 across 10 anchored intents × 3 repetitions. **Unaffected by IRE-6.**
* IPV reproducibility: 100% across 10 anchored intents × 5 repetitions, with identical standing and coordinate weights. **The standing-weight and seed-set halves stand; the coordinate-weight half is a pre-fix diagnostic and is withdrawn pending rerun.**
* Coverage: reported transparently as a corpus-density-dependent proxy (0.21 full anchored band; higher in dense canonical regions), not as a pass/fail criterion. **Unaffected by IRE-6.**

The most valuable Stage-0 findings were the failure modes:

* discovery-node pollution was identified and corrected;
* a measurement confound was found where changing the consensus model altered the baseline rather than improving evaluation;
* the protocol was subsequently frozen with those lessons incorporated.

The review questions are:

1. Does the protocol adequately distinguish instrument behaviour from measurement artefacts?
2. Is the frozen methodology sufficiently specified to proceed into EXP-P1?
3. Is the invariant substrate appropriate for the intended experimental investigation?

If the protocol meets your standard as an independent reviewer/protocol designer, your countersignature on EXP-P1 §15 will mark the transition from instrument validation into experimental execution.

Attached:

* EXP-P1 Protocol
* Stage-0 Handoff Record
* IRV-001 Validation Record
* IPV-001 Validation Record

Thanks for continuing to hold the methodological bar here. The main objective of Stage-0 was not to make the instrument look successful; it was to make sure that when we run EXP-P1, the results are interpretable.

Best,
Dele

---

# Internal — not for send

> Framing discipline (do not revise on send): lead with **0.21 full-band + corpus-density explanation + 1.0 stability + documented confound corrections**. Do NOT foreground the 0.57 densest-region figure — it is preserved in the record for diagnostic use only. The strongest reviewer story is experimental discipline, not metric optimisation.
>
> **Amended 2026-07-27 (IRE-6):** "100% IPV reproducibility" is removed from the lead — the
> coordinate half of it is a pre-fix diagnostic and is withdrawn pending a rerun. Lead instead with
> the correction itself: a units defect was found by our own audit, corrected, and the affected
> figure withdrawn before it was sent. That IS the experimental-discipline story this note claims to
> tell; sending the unlabelled figure would have contradicted it.

## Attachment sources (repo paths — attach/export these on send)

| Attachment | Source |
|---|---|
| EXP-P1 Protocol | `codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md` |
| Stage-0 Handoff Record | `codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/STAGE-0_HANDOFF.md` |
| IRV-001 Validation Record | `codexes/packs/irl/foundation/experiments/irv-001-invariant-resolution-validation/README.md` |
| IPV-001 Validation Record | `codexes/packs/irl/foundation/experiments/ipv-001-invariant-projection-validation/README.md` |

All four are also published in the **IRL OS cartridge** (Constitutional Evaluation / Experiments collection) — the external front door per the replication contract (`IRL_VALIDATION_ROADMAP.md`). Frozen-config for the record run: `provider=openai · persona=gpt-4o-mini · judge=gpt-4o · band=anchored`. Result commitments: IRV sha256 `258b64fda9aa9686…`, IPV sha256 `8f86238069142fcf…`.
