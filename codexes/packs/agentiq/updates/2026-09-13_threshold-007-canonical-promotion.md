# Threshold 007.2 — Canonical Research Edition Promotion (executed)

**Date:** 2026-09-13
**Status:** Threshold 007.2 is now `researchCompanionStatus = "canonical"`, with a first-class
`research_publication_records` row. The manuscript body and its candidate SHA are unchanged.
Scientific maturity is unchanged.

## 1–2. Canonical status vocabulary and first-class publication record

Confirmed before building: no canonical Research Edition promotion service/function existed
anywhere (repo grep, `pg_proc` inspection, and the prior turn's MCP capability manifest audit — the
metaMe Threshold bridge exposes exactly two live Qriptopian capabilities, both read-only projections).
`ai_metadata.researchCompanionStatus` had exactly one historical value across the entire `content`
table (`"candidate"`, on this same row) — no established second value existed to reuse, so this
migration establishes `"canonical"` as the only other defined value, set exclusively by the new
promotion function.

`supabase/migrations/20260913220000_research_canonical_promotion_boundary.sql` adds:

- **`public.research_publication_records`** — append-only (trigger-enforced). `candidate_sha256` is
  server-derived from the live, approved gate row at promotion time. A unique partial index
  (`content_id, candidate_sha256` where `publication_status='CANONICAL'`) enforces at most one
  canonical record per candidate at the database level, independent of the function's own idempotency
  check. `predecessor_publication_record_id` exists for future editions to supersede this one without
  rewriting history.
- **`public.promote_threshold_research_edition(content_id, candidate_version)`** — the only function
  permitted to create a `CANONICAL` row or set `ai_metadata.researchCompanionStatus = 'canonical'`.
- A narrow `BEFORE UPDATE` trigger on `content` (`content_guard_research_canonical_status`) that
  refuses any direct write setting `ai_metadata.researchCompanionStatus` to `'canonical'` unless a
  transaction-local flag set only by the promotion function is present. This guard is scoped to that
  one field/value transition — it does not restrict any other `ai_metadata` write on any content row.

## 3. Verification order (all server-derived, none caller-supplied)

`content` exists → gate exists → `gate_status = 'approved'` → `threshold_research_gate_is_publishable()`
is `true` → an admitted review exists → its bound candidate SHA still matches the gate's live candidate
(redundant with the gate's own guarantee, checked independently) → the admitted review has not been
superseded → `arr_disposition ∈ {PASS, PASS_WITH_DISCLOSED_GAPS}` → zero `publication_blockers` →
`evidence_resolved` and `no_evidence_regression` are `true` → idempotent replay if a canonical record
already exists for this exact candidate, otherwise insert + metadata mirror.

## 4. Promotion action performed

A. Created `research_publication_records` row (`RESEARCH_EDITION` / `CANONICAL`).
B. Set `ai_metadata.researchCompanionStatus = "canonical"`.
C. Mirrored `ai_metadata.currentResearchGate.status = "APPROVED"` (plus `gateStatus`,
   `arrDisposition`, `admittedReviewRecordId` for observability), replacing the stale
   `"EVIDENCE_RESOLUTION_REQUIRED"` value.
D. `content.status` untouched (`"published"`, unchanged from 2026-09-11 — a general/Reading-Edition
   publish, not conflated with Research-Edition canonicalization).
E/F. Manuscript body and candidate SHA untouched.
G. Publication provenance recorded on the new row's `publication_provenance` jsonb and mirrored into
   `ai_metadata.canonicalResearchPublication`.

`modalities.read.editions[research]` has no structured status field in its schema (only
`id`/`label`/`source`/`textSha256`/`description`/`sourceSha256`) — per explicit instruction, its prose
`description` was **not** touched to simulate state.

## 5. Write protection

Verified live: a direct `UPDATE ... SET ai_metadata = ai_metadata || '{"researchCompanionStatus":
"canonical"}'` against a synthetic fixture raised the guard's exception and left the field `null`
afterward (transaction rolled back). Promotion is possible only through
`promote_threshold_research_edition()`.

## 6. Invalidation / supersession

Not exercised in this task (no later candidate exists yet). The schema supports it:
`predecessor_publication_record_id` plus the append-only design means a later edition creates a new
row rather than mutating this one; withdrawal, if it ever occurs, would be modeled as a separate
mechanism, not a rewrite of this record.

## 7. Tests (synthetic fixtures only; all cleaned up afterward)

| # | Test | Result |
|---|---|---|
| 1 | `arr_pending` gate → refused | **PASS** — `gate_not_approved` |
| 2 | approved but `threshold_research_gate_is_publishable=false` → refused | **PASS** — `gate_not_publishable` (constructed via a deliberately inconsistent `evidence_resolved=false` + forced `gate_status='approved'` fixture, to isolate this check from #1) |
| 3 | approved + publishable + exact candidate → succeeds | **PASS** |
| 4 | candidate SHA mismatch → refused | **PASS** — `candidate_mutated_since_admission` (the promotion function's own redundant check, verified independently by temporarily disabling the gate's auto-invalidation trigger so the mismatch would otherwise have gone undetected by `gate_status` alone) |
| 5 | candidate mutation after gate approval → refused | **PASS** — same mechanism as #4 |
| 6 | `REVISION_REQUIRED`/superseding review → refused | **PASS** — `admitted_review_superseded` |
| 7 | evidence regression after approval → refused | **PASS** — `gate_not_publishable` (caught by the shared deterministic predicate) |
| 8 | duplicate promotion is idempotent/safely refused | **PASS** — second call returned `already_published: true`, same record id, no new row |
| 9 | promotion creates exactly one canonical research publication record | **PASS** |
| 10 | promotion sets `researchCompanionStatus='canonical'` | **PASS** |
| 11 | promotion mirrors `currentResearchGate.status='APPROVED'` | **PASS** |
| 12 | `content.status` remains unchanged | **PASS** |
| 13 | manuscript body/hash remains unchanged | **PASS** (no code path in the function ever touches it) |

Bonus: direct attempt to set `researchCompanionStatus='canonical'` outside the function was blocked
by the write-protection trigger (see §5).

## 8. Applied to Threshold 007.2

`promote_threshold_research_edition('a61343cb-d000-4359-a307-e9d380740eaa', '007.2')` — no direct
`UPDATE` statements.

## 9. Post-promotion read-back

| Field | Value |
|---|---|
| `research_publication_record_id` | `baaaf1e5-d9c6-4204-af26-c93ad38efa0b` |
| `publication_status` | `CANONICAL` |
| `researchCompanionStatus` before → after | `"candidate"` → `"canonical"` |
| `currentResearchGate.status` before → after | `"EVIDENCE_RESOLUTION_REQUIRED"` → `"APPROVED"` |
| `content.status` before → after | `"published"` → `"published"` (unchanged) |
| manuscript SHA before → after | `6648f21f…` → `6648f21f…` (unchanged) |
| `gate_id` | `ee82acea-a31b-41c4-a00d-871023fef4bb` |
| `admitted_review_record_id` | `12c8333d-89da-4b8f-b1ec-7a5321d391bc` |
| `arr_disposition_at_publication` | `PASS_WITH_DISCLOSED_GAPS` |
| `evidence_resolved_at_publication` / `no_evidence_regression_at_publication` | `true` / `true` |
| `published_at` | `2026-09-13 14:48:25.759218+00` |

## 10. Scientific state — unchanged

ARR: `PASS_WITH_DISCLOSED_GAPS`. Evidentiary maturity: B. Conceptual/research ceiling: C. H1b, `CH_Invariant
> CH_Baseline`, H3d, H4: all still unvalidated/unmeasured. EXP-001/002/003: preliminary only. EXP-P1
rehearsals: instrument/protocol-validation only. Cross-domain provenance ≠ cross-domain validation.
Trusted Superintelligence: proposed research object, not a demonstrated safety property. Canonical
publication is a provenance/legibility act, not a scientific promotion.
