# Threshold 007.2 — Publication Gate Approval Boundary (executed)

**Date:** 2026-09-13
**Status:** `content_publication_gates.gate_status` advanced to `approved` for Threshold 007.2.
`threshold_research_gate_is_publishable(...)` now returns `true`. **The manuscript has NOT been
published or promoted.** This task stopped at approval, per explicit instruction.

## 1. Inspect before building

Grepped `supabase/migrations/`, `services/`, `app/` for `approve*`, `gate_status`, `publication
gate`, `promotion`, and queried `pg_proc` directly for any function referencing
`content_publication_gates.gate_status` or `approved`. Nothing existed beyond
`content_publication_gates_guard_arr_write()` (which guards `arr_disposition`/`arr_review_record_id`
only) and unrelated CCRL/steward-participation "approval" concepts on different tables. **Confirmed:
no canonical gate-approval mechanism existed before this task.**

## 2. Publication Gate is not a reviewer

`approve_threshold_research_gate()` never touches `arr_disposition`, `evidentiary_maturity`,
`conceptual_ceiling`, the manuscript, or evidence records. It only reads them and, if every condition
holds, writes `gate_status='approved'` + `approved_at` + an approval-provenance note in the gate's
existing `provenance` jsonb column.

## 3/4/5. Implementation

- `supabase/migrations/20260913210000_research_publication_gate_approval_boundary.sql` — adds
  `content_publication_gates.approved_at`; a `BEFORE UPDATE` trigger
  (`content_publication_gates_guard_gate_status_write`) that refuses any `gate_status` write unless
  a transaction-local `research.gate_transition_in_progress` flag is set (mirroring the existing
  `arr_disposition` guard pattern); `approve_threshold_research_gate(content_id, candidate_version)`
  as the only function permitted to set that flag for a promotion; and an extension to
  `admit_research_review()` so that admitting a disqualifying disposition (anything other than
  `PASS`/`PASS_WITH_DISCLOSED_GAPS`) against an *already-approved* gate auto-reverts it to
  `arr_pending` in the same statement. A second safety net, inside the guard trigger itself, forces
  `gate_status` from `approved` down to `blocked` (and clears `approved_at`) the instant an approved
  gate's `candidate_text_sha256` changes underneath it — a downgrade-only path that needs no flag,
  since it is the guard protecting the gate, not a write to police.
- **Live bugfix, same day:** the first version of the guard trigger raised its own exception when
  its candidate-mutation auto-invalidation branch changed `gate_status` — it treated its own
  protective downgrade as an unauthorized write. Caught directly by testing the mutation against a
  live fixture (not by reasoning alone). Fixed by tracking whether that branch fired and exempting
  its own resulting change from the subsequent guard check. The corrected version is what's committed
  and what ran against Threshold 007.2.

## 6. Tests (synthetic fixtures only; all cleaned up afterward)

| # | Test | Result |
|---|---|---|
| 1 | `arr_pending` + no admitted ARR → refused | **PASS** — `no_admitted_review` |
| 2 | `PASS_WITH_DISCLOSED_GAPS` admitted + evidence resolved + no regression → succeeds | **PASS** |
| 3 | `REVISION_REQUIRED` → refused | **PASS** — `disposition_not_admissible_for_approval` |
| 4 | `evidence_resolved = false` → refused | **PASS** — `evidence_not_resolved` |
| 5 | `no_evidence_regression = false` → refused | **PASS** — `evidence_regression_present` |
| 6 | review SHA ≠ candidate SHA → refused | **PASS** — `candidate_mutated_since_admission` |
| 7 | candidate mutation after ARR admission → refused | **PASS** — same mechanism as #6 |
| 8 | superseded review → refused | **PASS** — `admitted_review_superseded` (a later review record with `parent_review_id` pointing at the admitted one, `lineage_relation='supersedes'`, present but not itself admitted) |
| 9 | duplicate approval is idempotent/safe | **PASS** — second call returned `already_approved: true`, no further write |
| 10 | approved state makes `threshold_research_gate_is_publishable(...)` return `true` | **PASS** |

Bonus (not in the required list, but load-bearing for the state-machine requirement): mutating an
*already-approved* fixture's candidate SHA auto-reverted `gate_status` to `blocked` and cleared
`approved_at` (this is where the live bug above was caught and fixed), and
`threshold_research_gate_is_publishable(...)` correctly returned `false` afterward.

## 7. Applied to Threshold 007.2

`approve_threshold_research_gate('a61343cb-d000-4359-a307-e9d380740eaa', '007.2')` was called — no
manual `UPDATE` of `gate_status` at any point.

## Read-back

| Field | Value |
|---|---|
| `candidate_sha256` | `6648f21f308e7395cba0c8d85bf48978f94b27d6f014f11f2ffa5c96ff2f3895` |
| `arr_review_record_id` | `12c8333d-89da-4b8f-b1ec-7a5321d391bc` |
| `arr_disposition` | `PASS_WITH_DISCLOSED_GAPS` |
| `publication_blockers` (from the admitted review) | `0` |
| `evidence_resolved` | `true` |
| `no_evidence_regression` | `true` |
| `gate_status_before` | `arr_pending` |
| `gate_status_after` | `approved` |
| `approved_at` | `2026-09-13 14:09:23.346405+00` |
| `threshold_research_gate_is_publishable('a61343cb-…','007.2')` | **`true`** |

## What was not done

No manuscript edit. No change to `arr_disposition`, review records, or reviewer authority. No
publication or promotion of the content itself — `gate_status='approved'` is a precondition for
publication, not publication. That remains a separate, not-yet-authorized act.
