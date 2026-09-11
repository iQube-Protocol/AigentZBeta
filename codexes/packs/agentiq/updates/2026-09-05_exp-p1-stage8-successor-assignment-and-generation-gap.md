# EXP-P1 Stage 8 — Successor Cohort Assignment + Crystal Generation Gap

**Date:** 2026-09-05
**Scope:** Track 2 / EXP-P1 (`financial-risk-value-systems`) readiness reconciliation and Stage 8 execution-gap repair.

## What was wrong

`runCrystalReadinessReport` was evaluating exactly 11 invariants against `invariant_contexts WHERE domain = 'financial-risk-value-systems'`, while Track 2's own orchestrator receipts reported 58 validated successor members. Mechanical reconciliation (read-only, before any write) established:

- All 11 members already in the crystal domain were **100% predecessor (Crystal vP1) material** — created 2026-07-20 to 2026-07-28, before the 2026-08-05 freeze. **Zero overlap** with the 58 successor members.
- Of the 58 successor members: **53 were already `validated`, `external-established`, and unassigned** — every criterion in `CRYSTAL_ELIGIBLE_STATUSES`/`CRYSTAL_ELIGIBLE_PROVENANCE` was met, but `upsertContext` had simply never been called for them (a Stage 8 execution gap, not a scientific exclusion). The remaining 5 were correctly provenance-ineligible (4 `platform-derived`, 1 `platform-hypothesized`).
- The oft-quoted "49 additional distinct member(s)" acquisition figure (`crystalAcquisitionBrief.ts`'s `requiredNetNewDistinctMembers = minimumCollectionSize(60) − report.invariantCount`) was **`60 − 11`**, i.e. a shortfall computed against the same stale 11-count — not an independently established acquisition need.

## What was done

Dry-run assertions (mechanical, against the live substrate, before any write):

| Assertion | Result |
|---|---|
| Exactly 53 distinct targeted IDs | ✓ 53 / 53 |
| Each `status = 'validated'` | ✓ 53 / 53 |
| Each provenance `external-established` | ✓ 53 / 53 |
| None already assigned to `financial-risk-value-systems` | ✓ 0 already assigned |
| None overlaps the 15 predecessor (vP1) invariant IDs | ✓ 0 overlap |
| Idempotent on rerun | ✓ by construction — `ON CONFLICT (invariant_id, domain) DO UPDATE`, the exact upsert semantics `services/invariants/store.ts::upsertContext` uses |

Cross-verified twice: once via direct SQL, and independently via the **actual** `evaluateCrystalAssignment`/`crystalDeclarationHash` functions from `services/research/crystalDomains.ts` run in isolation (pure, no DB) — both agree: 53/53 admitted, declaration hash `61b041c1f5cfcc39…`.

The assignment was then performed as one bounded, receipted act: 53 `invariant_contexts` upserts into `financial-risk-value-systems`, plus one `research_lifecycle_transition` activity receipt (id `b28284b6-7b26-4362-b89b-c866fa690967`) carrying experiment id, declaration hash, steward ref, eligibility criteria, member list (truncated at the receipt's existing 1000-char cap, same as the live route would produce), and rationale — mirroring the exact row shape and summary template of `POST /api/research/crystal/[experimentId]/assign`, executed directly against the substrate because this session has no live authenticated admin session or `SUPABASE_SERVICE_ROLE_KEY` available to call the route over HTTP (RLS on `invariant_contexts`/`activity_receipts` requires `service_role`).

No invariant text, provenance, validation state, namespace, remediation profile, task design, or the 40% guard was touched.

## Recomputed readiness state (post-write)

| Check | Before (11) | After (64) |
|---|---|---|
| Assigned population | 11 (100% predecessor) | **64** (11 predecessor + 53 successor) |
| Selection-space | FAIL (11 < 60) | **PASS** (64 ≥ 60; slice cap 25 < 64) |
| Derivation-headroom | FAIL | **Still FAIL** — `assessInferentialCapacity` over all 64 statements returns `entailmentChainCount = 0` (need ≥ 12). The material is almost entirely single-clause regulatory/compliance statements with no multi-premise entailment structure. |
| Boundary coverage | FAIL | **Still FAIL** — only `constitutional` and `finance` are represented; none of the 13 required-but-missing namespaces (reasoning, engineering, experience, capability, style, narrative, sovereignty, cybernetics, interaction, epistemology, representation, polity, commercialisation) are touched by any of the 53. |
| Structural diversity | informational | informational (non-gating; not recomputed in this pass) |

This matches the expectation stated going into this act: population floor closes without new acquisition; the two remaining freeze blockers (derivation headroom, namespace coverage) are real and require actual acquisition of relationally/causally-structured, ratified-namespace material — not a rerun of "get N more invariants."

## Architectural gap captured (follow-on, not fixed in this pass)

**Crystal generations are not represented in `invariant_contexts`.** The table's schema (`supabase/migrations/20260703200000_invariant_substrate.sql`) has no version/generation column — membership is `UNIQUE(invariant_id, domain)` only, forever. Crystal versioning exists *only* as a naming convention on `research_objects.object_id` (`EXP-P1/crystal-vP<N>`), completely decoupled from actual membership.

This is not merely a `runCrystalReadinessReport` quirk — it propagates into Stage 8's own completion signal. `services/research/track2Programme.ts:469`:

```ts
const populated = s.readiness.invariantCount > 0;
```

Stage 8 ("Assign to Crystal") is marked **`complete`** purely because the domain is non-empty — the same generation-blind `invariantCount` readiness itself uses. With only the 11 predecessor members present, Stage 8 showed `complete` the entire time the 58 successor members sat unassigned; nothing distinguished "populated by the intended current generation" from "populated by whatever happens to still be in the shared, unversioned domain row-set." This is exactly why stale predecessor assignment was able to masquerade as current Stage 8 completion.

**Recommended follow-on (not implemented here, per explicit instruction not to make this schema repair unless the existing assignment service could not safely distinguish cohorts — it can, via the acquisition-domain/`discovery_candidates` join used in this pass, so no repair was made):** Stage state must become generation-aware even while the underlying domain context stays shared — e.g. a generation/cohort marker on the assignment act (or a session-scoped disclosure of "members belonging to the currently-active generation" vs "legacy members present in the same domain row-set"), so `populated`/`invariantCount` can no longer be satisfied by predecessor history alone.
