# Threshold 007.2 — Legacy ARR Root & Admission (executed)

**Date:** 2026-09-13
**Status:** `content_publication_gates.arr_disposition` admitted for Threshold 007.2. Gate is
**still not publishable** (`gate_status` remains `arr_pending`). No manuscript change. No historical
gate rows fabricated for 007.1 or the intermediate addendum SHA.

## What was done, per explicit operator instruction

1. **Operator provenance attestation** recorded by appending to the existing
   `research_reviewer_authorities` row for `the-adversary-2026-09-13-review-chain`
   (`id=1857664b-661b-4449-aa71-6cb6602a8b51`), timestamped `2026-09-13 13:53:39.870907+00`. The
   attestation text is the operator's exact quote, scoped explicitly to provenance/independence of
   process — not a reviewer designation, not a publication override. The row's existing
   infrastructure-limitation disclosure (human-attested, not cryptographically session-proven
   independence) was preserved and reinforced, not removed.
2. **Legacy lineage root recorded** as a new `research_review_records` row
   (`id=12c8333d-89da-4b8f-b1ec-7a5321d391bc`), `review_type=CANDIDATE_DELTA_CONFIRMATION`,
   `parent_review_id=88c42961-46e0-4612-961a-cc81729b88ce` (the original bootstrap import row,
   `lineage_relation=supersedes`), `legacy_review_import=true`. Its `legacy_provenance` explicitly
   sets `legacy_lineage_root: true` and lists the Original ARR and Post-ARR Addendum as
   `historical_ancestry` entries — disclosed as non-native, non-fabricated historical provenance,
   never presented as if they were native `research_review_records` rows. No historical
   `content_publication_gates` row was created for 007.1 or the `824dd19d…` addendum SHA, per
   explicit instruction.
3. `candidate_sha256` was **server-derived** at insert time (the same trigger as always — never
   caller-supplied) and confirmed to equal `6648f21f308e7395cba0c8d85bf48978f94b27d6f014f11f2ffa5c96ff2f3895`.
4. `admit_research_review('12c8333d-89da-4b8f-b1ec-7a5321d391bc')` was called. It returned
   `admitted: true`. No manual write to `arr_disposition` was performed at any point.

## Read-back

| Field | Value |
|---|---|
| `research_review_records.id` | `12c8333d-89da-4b8f-b1ec-7a5321d391bc` |
| `candidate_sha256` (server-verified) | `6648f21f308e7395cba0c8d85bf48978f94b27d6f014f11f2ffa5c96ff2f3895` |
| `reviewer_role_at_review` | `adversary` |
| `reviewer_principal_ref` | `the-adversary-2026-09-13-review-chain` |
| `legacy_review_import` | `true` |
| `parent_review_id` / `lineage_relation` | `88c42961-46e0-4612-961a-cc81729b88ce` / `supersedes` |
| `disposition` | `PASS_WITH_DISCLOSED_GAPS` |
| `publication_blockers` | `0` |
| `material_evidence_regression` | `false` |
| `evidentiary_maturity` | `B` |
| `conceptual_ceiling` | `C` |
| `content_publication_gates.arr_review_record_id` | `12c8333d-89da-4b8f-b1ec-7a5321d391bc` |
| `content_publication_gates.arr_disposition` | `PASS_WITH_DISCLOSED_GAPS` |
| `gate_status` | `arr_pending` (unchanged) |
| `evidence_resolved` | `true` (unchanged, already true) |
| `no_evidence_regression` | `true` (unchanged, already true) |
| `threshold_research_gate_is_publishable('a61343cb-…','007.2')` | **`false`** |

## Why publishable is still false, and what's left

`admit_research_review()` never writes `gate_status`. The deterministic predicate requires
`gate_status = 'approved'` in addition to the ARR/evidence conditions, and that field is untouched
by this task — exactly as designed, and exactly why "Adversary cannot directly approve publication"
(tested in the admission-boundary build) holds here too. Advancing `gate_status` to `'approved'` is
a **separate, deliberately distinct act** reserved to the Publication Gate role, not automated by
admission. This document does not perform it and was not authorized to.
