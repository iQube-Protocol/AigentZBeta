# EXP-P1 Reviewer Package — Cover Note (Austin) — EXP-P1 SPECIFIC

**Status: DRAFT — NOT SENT. A distinct package from `AUSTIN_COVER_NOTE.md` (the Stage-0/IRE/IPV instrument-validation package, which remains separately held — see below). This note does not reference, resolve, waive, or depend on that hold in any way.**

<!-- The sendable note is the text between the two horizontal rules below. Everything under "Internal — not for send" is repo-only context and must not be included when sending. -->

---

Hi Austin,

I'm sending over the EXP-P1 Reviewer Kit for your independent review as protocol designer and, if you're satisfied, your countersignature on EXP-P1 §15.

**What this package is:**

- **`AUSTIN_REVIEWER_KIT.md`** — the complete reviewer kit: executive brief, the frozen experimental substrate, the registered protocol's own arm definitions/MDE/controls/repetition plan/interpretation table (quoted, not restated), the frozen Arm B `task-scoped-v1` treatment specification, the internal v1→v4 apparatus-development lineage, the latest internal apparatus report, known limitations, and the discrete decisions/deliverables this ask needs from you.
- **The registered EXP-P1 protocol** (`README.md`, this directory) — still `DRAFT FOR SIGN-OFF`, unchanged since you last saw it in this form.
- **Frozen substrate:** Crystal `EXP-P1/crystal-vP2` — content hash `c85ea160ec6615d13b7c9b978d28c96480123a7c867c37a319d16d1bd8bd685b`, 63 members, frozen as `internal-pilot` (not confirmatory) with two acknowledged scientific deviations (derivation-headroom, boundary-coverage) recorded and unchanged since freeze.

**What has happened since the protocol was drafted:** an internal engineering programme built and stress-tested the measurement apparatus — the frozen Arm B selector, a retrieval-recall rehearsal, a genuine per-arm execution/evidence-of-use rehearsal, and (most recently) a durability fix to the execution pipeline itself. **Every one of these is apparatus validation, not a scientific result.** None used the registered protocol's own controls — no k=5 repetitions, no external held-out task set, no external Arm D, no judge/rubric. The kit's own §6 reports the latest run under an explicit `INTERNAL / PROVISIONAL / NON-CONFIRMATORY / APPARATUS VALIDATION` label; nothing in it should be read as evidence toward the hypothesis, and no number in it has been used to change the frozen selector, Crystal, arm definitions, task budget, prompts, or scoring mechanisms.

**What I'm asking of you, specifically** (the kit's §8 has the full detail):

1. Review/accept or challenge the experimental apparatus described above.
2. Review the Arm B/C treatment distinction and the Mechanistic Difference Enumeration.
3. If satisfied, countersign EXP-P1 §15 — the same constitutional act that freezes the protocol and opens your agent's submission authority.
4. Provide or control the sealed held-out confirmatory task set and answer key, per the protocol's own custody terms.
5. Provide or approve the independent expert-prose Arm D.
6. Establish the judge/rubric and the independent/secondary judging procedure.
7. Confirm the repetition/statistical plan (k=5, bootstrap CIs, the pre-agreed signal threshold).
8. Authorize confirmatory freeze once every prerequisite above is in place.

**One thing this note deliberately does NOT do:** it does not touch, resolve, or ask anything about the earlier Stage-0 (IRE/IPV) package you already have open — that package's `⚠ HOLD — do not send` correction notice (IRE-6, 2026-07-27) is untouched and remains pending on its own separate rerun. This EXP-P1 package has no dependency on that result; the frozen Arm B selector's own code does not use the coordinate/projection mechanism that defect affects. I'm keeping the two packages distinct rather than bundling them, precisely so a hold on one is never mistaken for a hold on the other.

Attached:

* EXP-P1 Reviewer Kit
* EXP-P1 Protocol

Best,
Dele

---

# Internal — not for send

## Why this is a SEPARATE document from AUSTIN_COVER_NOTE.md

`AUSTIN_COVER_NOTE.md` bundles the Stage-0 (IRE/IPV instrument validation) package with an EXP-P1 countersignature ask, and carries a live, unresolved `⚠ HOLD — do not send` notice (IRE-6, operator ruling 2026-07-27; the Stage-0 coordinate-weight rerun this requires has not been run as of this note's authoring). Mechanical trace (2026-09-08): the registered EXP-P1 protocol (`README.md`), the Crystal vP2 freeze record, and the frozen Arm B `task-scoped-v1` selector's own code all contain ZERO references to Stage-0/IRE/IPV/coordinate calibration — `services/invariants/taskScopedSelection.ts` explicitly states the coordinate/projection mechanism "is NOT a runtime grounding-selection ranking signal today, and this module does not import or call any of it." The only place a dependency is asserted is `STAGE-0_HANDOFF.md`'s own "EXP-P1 entry conditions" list (a companion document, not the registered protocol) — a claim never incorporated into the protocol itself. Verdict: **IRE-6 does not gate EXP-P1.** `AUSTIN_COVER_NOTE.md` and its HOLD are left completely unchanged, still unresolved, and classified as a **historical package hold — still unresolved; does not authorize sending that package; not an EXP-P1 prerequisite.**

This note is EXP-P1's own, independent cover note — it may be sent (pending operator approval) without waiting on, waiving, or resolving IRE-6.

## Attachment sources (repo paths)

| Attachment | Source |
|---|---|
| EXP-P1 Reviewer Kit | `codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/AUSTIN_REVIEWER_KIT.md` |
| EXP-P1 Protocol | `codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md` |

Both are registered in `codexes/packs/irl/collections.json`'s `col_experiments`, and both resolve, via `services/research/irlExperimentPathScope.ts::experimentIdForIrlPackPath`, to `EXP-P1` — reachable by any persona holding an active `research-lab` grant in a review-readable role scoped to `EXP-P1` (Phase 2 scoped restoration, 2026-09-08), through either `GET /api/codex/packs/irl/file?path=<path>` or `GET /api/public/irl/doc?path=<path>`.

## Do NOT send this note yet

Sending requires: (1) operator approval of this note's text, (2) an actual invitation/grant issued to Austin's persona (scoped `research-lab`, role `reviewer`, `allowed_experiments: ['EXP-P1']`, per `services/passport/participationAccess.ts::createAccessInvitation`), and (3) the deployed scoped-restoration verified end-to-end. See the accompanying chat report for current status of each.
