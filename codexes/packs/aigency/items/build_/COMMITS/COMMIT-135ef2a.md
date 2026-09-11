# Commit Brief: `135ef2a` — Fix Establish Presence evidence resolution: recognize a Passport held under a merged auth profile

| Field | Value |
|-------|-------|
| SHA | [`135ef2a`](https://github.com/iQube-Protocol/AigentZBeta/commit/135ef2a55c6b7a61955548155685a6dd5cdf7430) |
| Author | Claude |
| Date | 2026-08-29T18:05:53Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix Establish Presence evidence resolution: recognize a Passport held under a merged auth profile

Root cause: services/identity/passportPrincipal.ts's listOwnedPersonaIds
(the shared scope loadUsableCitizenPassportForAuthProfile depends on, and
therefore the Establish Presence stage's citizenPassportUsable evidence)
scoped only to the caller's single currently-resolved auth profile.
services/identity/getActivePersona.ts's OWN persona enumeration already
widens across every auth profile merged to the caller's own
(getMergedLinkedAuthProfileIds, crm_auth_profile_links relationship_mode
'merged') -- passportPrincipal.ts did not, so a Citizen Passport issued to
a persona under a merged sibling auth profile read as absent even though
the caller's own session already recognizes that persona as owned. This
is the Presence-side instance of the same evidence-resolution defect
class as the Orientation read-path fix: the canonical fact already
exists; the query scope was too narrow to find it.

listOwnedPersonaIds now widens via getMergedLinkedAuthProfileIds -- the
SAME merge resolver getActivePersona.ts already calls (inv.engineering.
036/037), never a second, independently derived notion of "the holder's"
auth profiles. Fails open to the single-profile scope on a merge-lookup
error, never a hard failure.

Also fixes a latent regression this exposed: services/wallet/
multiEmailIdentity.ts constructed its Supabase client EAGERLY at module
import time (`export const db = createClient(...)`), which throws
immediately in any environment without Supabase env vars configured --
harmless for its original direct consumers (Next.js API routes, where
env vars are always present) but a hard crash once
getMergedLinkedAuthProfileIds gained a new caller reachable from
hermetic test suites. Replaced with getDb(), a lazy cached client
matching the same pattern app/api/_lib/supabaseServer.ts's
getSupabaseServer() already uses; updated the three routes that
imported `db` directly (wallet/identity/links, preferences, emails) to
call getDb() instead.

No receipt written, no new Passport, no hardcoded completion -- the
repair makes the journey recognize canonical personhood-level state
that already exists, per the newly ratified Implementation Singularity
/ "constitutional journeys consume established state" doctrine.

Delegation (optional, already non-blocking per resolveJourneyState.ts's
OPTIONAL-prerequisite bypass) and artifact/Confirm-this-artifact
(getExchangeView's exact-persona membership match, correct once signed
in as the exchange-bound principal) were traced and found structurally
sound -- no changes needed there.

10 new/updated tests: tests/passport-merged-auth-profile-recognition.test.ts
(listOwnedPersonaIds widening, fail-open on merge-lookup error, Passport
recognized only when actually merged, never for a genuinely unrelated
profile) plus the stale journey-admission-spine.test.ts canary updated
to match the new (correct) query shape.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

Root cause: services/identity/passportPrincipal.ts's listOwnedPersonaIds
(the shared scope loadUsableCitizenPassportForAuthProfile depends on, and
therefore the Establish Presence stage's citizenPassportUsable evidence)
scoped only to the caller's single currently-resolved auth profile.
services/identity/getActivePersona.ts's OWN persona enumeration already
widens across every auth profile merged to the caller's own
(getMergedLinkedAuthProfileIds, crm_auth_profile_links relationship_mode
'merged') -- passportPrincipal.ts did not, so a Citizen Passport issued to
a persona under a merged sibling auth profile read as absent even though
the caller's own session already recognizes that persona as owned. This
is the Presence-side instance of the same evidence-resolution defect
class as the Orientation read-path fix: the canonical fact already
exists; the query scope was too narrow to find it.

listOwnedPersonaIds now widens via getMergedLinkedAuthProfileIds -- the
SAME merge resolver getActivePersona.ts already calls (inv.engineering.
036/037), never a second, independently derived notion of "the holder's"
auth profiles. Fails open to the single-profile scope on a merge-lookup
error, never a hard failure.

Also fixes a latent regression this exposed: services/wallet/
multiEmailIdentity.ts constructed its Supabase client EAGERLY at module
import time (`export const db = createClient(...)`), which throws
immediately in any environment without Supabase env vars configured --
harmless for its original direct consumers (Next.js API routes, where
env vars are always present) but a hard crash once
getMergedLinkedAuthProfileIds gained a new caller reachable from
hermetic test suites. Replaced with getDb(), a lazy cached client
matching the same pattern app/api/_lib/supabaseServer.ts's
getSupabaseServer() already uses; updated the three routes that
imported `db` directly (wallet/identity/links, preferences, emails) to
call getDb() instead.

No receipt written, no new Passport, no hardcoded completion -- the
repair makes the journey recognize canonical personhood-level state
that already exists, per the newly ratified Implementation Singularity
/ "constitutional journeys consume established state" doctrine.

Delegation (optional, already non-blocking per resolveJourneyState.ts's
OPTIONAL-prerequisite bypass) and artifact/Confirm-this-artifact
(getExchangeView's exact-persona membership match, correct once signed
in as the exchange-bound principal) were traced and found structurally
sound -- no changes needed there.

10 new/updated tests: tests/passport-merged-auth-profile-recognition.test.ts
(listOwnedPersonaIds widening, fail-open on merge-lookup error, Passport
recognized only when actually merged, never for a genuinely unrelated
profile) plus the stale journey-admission-spine.test.ts canary updated
to match the new (correct) query shape.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/wallet/identity/emails/route.ts` |
| Modified | `app/api/wallet/identity/links/route.ts` |
| Modified | `app/api/wallet/identity/preferences/route.ts` |
| Modified | `services/identity/passportPrincipal.ts` |
| Modified | `services/wallet/multiEmailIdentity.ts` |
| Modified | `tests/journey-admission-spine.test.ts` |
| Added | `tests/passport-merged-auth-profile-recognition.test.ts` |

## Stats

 8 files changed, 285 insertions(+), 25 deletions(-)
