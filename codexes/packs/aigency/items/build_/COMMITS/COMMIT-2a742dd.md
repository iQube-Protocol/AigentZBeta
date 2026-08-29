# Commit Brief: `2a742dd` — Harden Orientation READ path: principal-aware evidence resolution

| Field | Value |
|-------|-------|
| SHA | [`2a742dd`](https://github.com/iQube-Protocol/AigentZBeta/commit/2a742dd150d683a23c1dc8189f2d2e2fc9c485b6) |
| Author | Claude |
| Date | 2026-08-29T17:42:01Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Harden Orientation READ path: principal-aware evidence resolution

Fix the gap that made the write-path principal gate (93aa78b04)
unreachable: fetchIanAuthoritativePlatformState's orient-stage evidence
was a bare hasReceiptType('orientation_ritual_completed') scoped to
whichever persona is currently active, with no principal-type or
exchange-binding check. Ian's constitutionally invalid, aigentMe-
attributed receipt therefore satisfied Orient COMPLETE for that exact
persona, which shadowed the Orientation/Acknowledge UI from ever
rendering.

Add resolveOrientationEvidence() (services/journey/ianJourneyState.ts):
walks every persona under the caller's auth profile, and for each
sibling holding an orientation_ritual_completed receipt, runs the SAME
resolveOrientationPrincipalGate() the write route already enforces --
never a second, independently encoded definition of who counts as
principal (Implementation Singularity, inv.constitutional.361/362).
Orient reads COMPLETE only when some sibling's receipt passes that
gate; a delegated-agent or unrelated-sibling receipt is skipped, never
repaired, deleted, or reassigned.

Add listActivityReceiptsForPersonas() (services/receipts/
activityReceiptService.ts) to read across multiple sibling personas at
once, returning {record, personaId} pairs (personaId is T0 and stays
out of ActivityReceiptRecord itself, matching the existing
findLocalReceiptsPendingDvnAnchor/findReceiptsByIds pairing pattern).

Presence/passport evidence semantics are untouched -- explicitly out
of scope for this patch pending a live-data check of Ian's actual
Passport state.

12 new regression tests in tests/ian-orientation-principal-gate.test.ts
cover: exchange-bound principal receipt -> COMPLETE; same-auth-profile
aigentMe receipt -> NOT COMPLETE; unrelated sibling receipt -> NOT
COMPLETE; no receipt -> NOT COMPLETE; the historical aigentMe receipt
read but never mutated; read/write consistency (a write the route
refuses produces no evidence the read path accepts, and a write it
permits reads back COMPLETE); fail-closed with no DB client or no
authProfileId yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9
```

## Body

Fix the gap that made the write-path principal gate (93aa78b04)
unreachable: fetchIanAuthoritativePlatformState's orient-stage evidence
was a bare hasReceiptType('orientation_ritual_completed') scoped to
whichever persona is currently active, with no principal-type or
exchange-binding check. Ian's constitutionally invalid, aigentMe-
attributed receipt therefore satisfied Orient COMPLETE for that exact
persona, which shadowed the Orientation/Acknowledge UI from ever
rendering.

Add resolveOrientationEvidence() (services/journey/ianJourneyState.ts):
walks every persona under the caller's auth profile, and for each
sibling holding an orientation_ritual_completed receipt, runs the SAME
resolveOrientationPrincipalGate() the write route already enforces --
never a second, independently encoded definition of who counts as
principal (Implementation Singularity, inv.constitutional.361/362).
Orient reads COMPLETE only when some sibling's receipt passes that
gate; a delegated-agent or unrelated-sibling receipt is skipped, never
repaired, deleted, or reassigned.

Add listActivityReceiptsForPersonas() (services/receipts/
activityReceiptService.ts) to read across multiple sibling personas at
once, returning {record, personaId} pairs (personaId is T0 and stays
out of ActivityReceiptRecord itself, matching the existing
findLocalReceiptsPendingDvnAnchor/findReceiptsByIds pairing pattern).

Presence/passport evidence semantics are untouched -- explicitly out
of scope for this patch pending a live-data check of Ian's actual
Passport state.

12 new regression tests in tests/ian-orientation-principal-gate.test.ts
cover: exchange-bound principal receipt -> COMPLETE; same-auth-profile
aigentMe receipt -> NOT COMPLETE; unrelated sibling receipt -> NOT
COMPLETE; no receipt -> NOT COMPLETE; the historical aigentMe receipt
read but never mutated; read/write consistency (a write the route
refuses produces no evidence the read path accepts, and a write it
permits reads back COMPLETE); fail-closed with no DB client or no
authProfileId yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NQfGRfi4TgkQbnzUxbMKG9

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `services/journey/ianJourneyState.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |
| Modified | `tests/ian-orientation-principal-gate.test.ts` |

## Stats

 4 files changed, 328 insertions(+), 5 deletions(-)
