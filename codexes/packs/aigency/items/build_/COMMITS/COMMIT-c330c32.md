# Commit Brief: `c330c32` — Activate ExperienceIntentProjection end-to-end + FS LEARN/EXPLORE evidence [merge review/irl-scoped-restoration-2026-08-27]

| Field | Value |
|-------|-------|
| SHA | [`c330c32`](https://github.com/iQube-Protocol/AigentZBeta/commit/c330c32ab204572490d14f49f7a7632242ae8a69) |
| Author | Claude |
| Date | 2026-09-01T12:05:08Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Activate ExperienceIntentProjection end-to-end + FS LEARN/EXPLORE evidence [merge review/irl-scoped-restoration-2026-08-27]

Three-commit catch-up push: an earlier LEARN/EXPLORE commit (dc1f968cc)
was built on locally but never actually cherry-picked to dev on its own —
subsequent deploys were built on top of it locally without re-including it,
so dev has been missing it until now. All three land together in the
correct order:

1. LEARN/EXPLORE: kind-discriminated FS evidence, not a bare Continue
   click. fs-learn requires all three Advisor/Architect/Runtime concept
   cards individually acknowledged; fs-explore requires a real MoneyPenny
   serviceCatalog capability actually clicked. Both reuse the same generic
   experience_interaction_observed receipt family via a new
   interactionKind/capabilityId discriminator, never a new action type.
   services/journey/financialSovereigntyEvidence.ts is the single source
   of truth for the FS concept-id/interactionKind literals shared by
   KNYTS/CI's state routes.

2. Carousel cap lowered to 7 (from the same-day 8) — both bridges' ambient
   pre-FS spine is exactly seven stages, so Choose is always the last
   stage visible by default, never bleeding into fs-discover.

3. ExperienceIntentProjection activated end-to-end (AEE-XP-001 XP-1
   follow-up): services/adaptive/experienceIntentAssembly.ts is the one
   shared, read-only assembler both KNYTS/CI state routes now call,
   populating declared (runtimeState.activatedBranches — already
   server-relayed, no new client->server channel needed), observed (real
   experience_interaction_observed receipts), and deliberately leaving
   inferred empty (no legitimate inference source yet). nativeProvider.ts
   now reads context.experienceIntent for presentation only — signal
   reporting, density, and ordering among equally-reachable capabilities —
   never reachability, blocked-capability promotion, or authority.

Verified against current dev (re-synced): typecheck holds at 677
pre-existing errors; full suite's failing set is byte-identical to the
established 17-file/50-test baseline.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Three-commit catch-up push: an earlier LEARN/EXPLORE commit (dc1f968cc)
was built on locally but never actually cherry-picked to dev on its own —
subsequent deploys were built on top of it locally without re-including it,
so dev has been missing it until now. All three land together in the
correct order:

1. LEARN/EXPLORE: kind-discriminated FS evidence, not a bare Continue
   click. fs-learn requires all three Advisor/Architect/Runtime concept
   cards individually acknowledged; fs-explore requires a real MoneyPenny
   serviceCatalog capability actually clicked. Both reuse the same generic
   experience_interaction_observed receipt family via a new
   interactionKind/capabilityId discriminator, never a new action type.
   services/journey/financialSovereigntyEvidence.ts is the single source
   of truth for the FS concept-id/interactionKind literals shared by
   KNYTS/CI's state routes.

2. Carousel cap lowered to 7 (from the same-day 8) — both bridges' ambient
   pre-FS spine is exactly seven stages, so Choose is always the last
   stage visible by default, never bleeding into fs-discover.

3. ExperienceIntentProjection activated end-to-end (AEE-XP-001 XP-1
   follow-up): services/adaptive/experienceIntentAssembly.ts is the one
   shared, read-only assembler both KNYTS/CI state routes now call,
   populating declared (runtimeState.activatedBranches — already
   server-relayed, no new client->server channel needed), observed (real
   experience_interaction_observed receipts), and deliberately leaving
   inferred empty (no legitimate inference source yet). nativeProvider.ts
   now reads context.experienceIntent for presentation only — signal
   reporting, density, and ordering among equally-reachable capabilities —
   never reachability, blocked-capability promotion, or authority.

Verified against current dev (re-synced): typecheck holds at 677
pre-existing errors; full suite's failing set is byte-identical to the
established 17-file/50-test baseline.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/journey/constitutional-internet-bridge/state/route.ts` |
| Modified | `app/api/journey/knyts-bridge/state/route.ts` |
| Added | `services/adaptive/experienceIntentAssembly.ts` |
| Modified | `services/adaptive/nativeProvider.ts` |
| Modified | `services/journey/experienceObservationPromotion.ts` |
| Modified | `tests/ci-bridge-state-aee-wiring.test.ts` |
| Added | `tests/experience-intent-projection-activation.test.ts` |
| Modified | `tests/knyts-bridge-state-aee-wiring.test.ts` |

## Stats

 9 files changed, 623 insertions(+), 14 deletions(-)
