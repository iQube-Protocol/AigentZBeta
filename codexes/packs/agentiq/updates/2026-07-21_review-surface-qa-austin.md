# Review-surface QA — Austin's agent's four items (the first bug report through the Threshold)

**Date:** 2026-07-21 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha` · **Type:** fix
**Origin:** Austin's agent filed a QA list against the Threshold review surface (Aletheon: "review blockers, not paper comments" — and it's exactly what the Threshold was built to surface: the reviewer is now reviewing the *laboratory*, not just the paper).

**Not related to the security hardening** — that was the OAuth/auth surface. These are document-resolution, lifecycle-honesty, and result-readability defects on the review surface.

## ① `read_shared_document` — path scheme mismatch (fixed)

**Defect:** `/api/public/irl/doc?path=` reads *pack-relative* paths (`foundation/…`), but the registry publishes `protocolRef` as *repo-relative* (`codexes/packs/irl/foundation/…`). Passing a protocolRef verbatim double-prefixed → 404.

**Fix:** `app/api/public/irl/doc/route.ts::sanitizePath` now accepts BOTH schemes — it strips a leading `./` and the `codexes/packs/irl/` prefix, so a registry protocolRef resolves. (The gateway's `read_shared_document` forwards to this route, so both are fixed together.)

## ② EXP-P1 lifecycle presenting as `running` (fixed)

**Defect:** `deriveOverview` (`services/research/lifecycle.ts`) floored every zero-run experiment to **`running`** — so EXP-P1 (unsigned, no runs) showed as running rather than pre-freeze.

**Fix:** the floor is now **`designed`** absent published runs — verified over claimed (inv.polity.162 + the newly-ratified inv.reasoning.346–349). `published`/`replicated` still derive from real published-run evidence; a true `running`/`protocol-ratified` state is set explicitly via `recordExperimentTransition`, never floored from absence. EXP-P1 (and every design-stage experiment) now presents honestly as pre-freeze until its joint signature exists.

## ③ Raw result JSON readable through the Threshold (fixed)

**Gap:** the published, hash-committed result records were public at `/api/public/irl/experiments-results`, but not reachable *through the Threshold* — so a reviewer's agent couldn't hash-verify through the review surface itself.

**Fix:** new **public, read-only gateway tool `read_experiment_results(experiment?)`** → `irlAdapter.readResults` → `/api/public/irl/experiments-results`. Returns the verbatim, T2-safe result records with the verification note (recompute sha256 over the JSON, compare to the anchored content hash). No crossing required — this is the reviewer-exercisable verification surface Austin's point ③ asks for.

## ④ Crystal-domain + collection-size answers (already delivered)

**Already answered** in the frozen-protocol ratification earlier today (`2026-07-21_experiment-integrity-frozen-protocol.md`), pre-registered in EXP-P1 itself:
- **§12 interpretation table** — crystal-domain limitation (`inv.reasoning.349`): Phase 1 evaluates the runtime against the corpus it was derived from = internal-coherence validation, NOT a generality claim; neutral-domain validation is a distinct later phase. No EXP-P1 outcome may be read as domain-independent generalisation.
- **§3 materials** — collection-size guard: the fixed Arm C slice must be **⊆ 40% of `Crystal vP1`**, else Arm B's live selection can't differ from Arm C's fixed slice and the comparison degenerates. If the 18-invariant collection is too small, enlarge it or substitute a neutral-domain collection before freeze.

So ④ is deliverable to Austin now, pointing at EXP-P1 §3/§12.

## Files

`app/api/public/irl/doc/route.ts`, `services/research/lifecycle.ts`, `services/threshold/gateway.ts` (+ tool), `services/threshold/irlAdapter.ts` (`readResults`), `tests/threshold-gateway.test.ts` (canary).

No migration; no gate weakened; no T0 exposure. `read_shared_document` improvements ride the earlier resilient-fetch retry as well.
