# Commit Brief: `96e22fd` — Fix People 504 (ContactGraph N+1 projection) and unsafe Gmail-composer resolution claims

| Field | Value |
|-------|-------|
| SHA | [`96e22fd`](https://github.com/iQube-Protocol/AigentZBeta/commit/96e22fd662dc9888240a45154ef6337aa88f4a94) |
| Author | Claude |
| Date | 2026-08-27T09:44:24Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix People 504 (ContactGraph N+1 projection) and unsafe Gmail-composer resolution claims

Two independent regressions on the same aigentMe surface.

1. People/ContactGraph 504 (application-level timeout, not a missing
   migration — supabase/migrations/20260930050000_contactgraph_substrate.sql
   already creates contact_persons/contact_personas/contact_endpoints with
   owner-scoped indexes). services/contactGraph/projection.ts's
   requestContactGraphProjection looped over EVERY granted ContactPerson id
   and, per id, called getContactPerson + listContactPersonas (each doing its
   own ownership-check query plus a list query), then looped over every
   returned persona calling listContactEndpoints again — for a persona with
   a large address book (the route's own header cites 1,200+ rows observed
   live) this fanned a single GET /api/contactgraph/people out into
   thousands of sequential Supabase round trips. Fixed with two new batched
   reads (listContactPersonasForOwner, listContactEndpointsForPersonas),
   each one indexed .in(...) query for the whole page; projection.ts groups
   in memory. Total query count for a full projection: 3, regardless of
   address-book size — down from ~2N+2M sequential round trips.

2. Conversation safety — aigentMe replied 'Opening the Gmail composer...'
   after failing to resolve both a recipient ("Abi Atanda") and an
   attachment ("our latest business plan"), independent of the 504's root
   cause. Two contributing defects:
     - app/data/personas.ts's aigent-me system prompt explicitly instructed
       the LLM to 'still open the composer' when it doesn't know the
       recipient, and said nothing about attachment verification —
       contradicting the SAME prompt's own 'Never imply an action was
       completed unless it was' rule. Replaced with an explicit gate:
       recipient AND attachment must both be resolved before claiming
       readiness; otherwise stop and name what's missing.
     - AigentMeWelcomeSplitTab.tsx's openComposeByKind (chat-evolved-draft/
       resend path) queried /api/contacts?limit=1 and fell back to using the
       raw, unresolved NAME STRING as the composer 'to' value on any search
       failure or empty result. Fixed to never guess: bumped to limit=5 so
       ambiguity is detectable, and 'to' now stays empty unless exactly one
       candidate has a real email address.

   Document/attachment resolution for a fuzzy reference ('our latest
   business plan') does not exist anywhere in this codebase — confirmed by
   search. Building that capability is a genuine feature gap, not a
   regression, and is out of scope here; this fix closes the safety property
   that holds regardless (never CLAIM an attachment that was never found).
   The lower-level draftEmail.ts service already had the correct
   never-fabricate rules for both recipient and attachment — this fix makes
   the layers ABOVE it (system prompt, client prefill) stop bypassing them.

Tests: tests/contactgraph-people-projection-batching.test.ts (batching +
migration-not-missing verification) and
tests/aigentme-email-recipient-attachment-safety.test.ts (prompt + client
fallback safety) — both new.
```

## Body

Two independent regressions on the same aigentMe surface.

1. People/ContactGraph 504 (application-level timeout, not a missing
   migration — supabase/migrations/20260930050000_contactgraph_substrate.sql
   already creates contact_persons/contact_personas/contact_endpoints with
   owner-scoped indexes). services/contactGraph/projection.ts's
   requestContactGraphProjection looped over EVERY granted ContactPerson id
   and, per id, called getContactPerson + listContactPersonas (each doing its
   own ownership-check query plus a list query), then looped over every
   returned persona calling listContactEndpoints again — for a persona with
   a large address book (the route's own header cites 1,200+ rows observed
   live) this fanned a single GET /api/contactgraph/people out into
   thousands of sequential Supabase round trips. Fixed with two new batched
   reads (listContactPersonasForOwner, listContactEndpointsForPersonas),
   each one indexed .in(...) query for the whole page; projection.ts groups
   in memory. Total query count for a full projection: 3, regardless of
   address-book size — down from ~2N+2M sequential round trips.

2. Conversation safety — aigentMe replied 'Opening the Gmail composer...'
   after failing to resolve both a recipient ("Abi Atanda") and an
   attachment ("our latest business plan"), independent of the 504's root
   cause. Two contributing defects:
     - app/data/personas.ts's aigent-me system prompt explicitly instructed
       the LLM to 'still open the composer' when it doesn't know the
       recipient, and said nothing about attachment verification —
       contradicting the SAME prompt's own 'Never imply an action was
       completed unless it was' rule. Replaced with an explicit gate:
       recipient AND attachment must both be resolved before claiming
       readiness; otherwise stop and name what's missing.
     - AigentMeWelcomeSplitTab.tsx's openComposeByKind (chat-evolved-draft/
       resend path) queried /api/contacts?limit=1 and fell back to using the
       raw, unresolved NAME STRING as the composer 'to' value on any search
       failure or empty result. Fixed to never guess: bumped to limit=5 so
       ambiguity is detectable, and 'to' now stays empty unless exactly one
       candidate has a real email address.

   Document/attachment resolution for a fuzzy reference ('our latest
   business plan') does not exist anywhere in this codebase — confirmed by
   search. Building that capability is a genuine feature gap, not a
   regression, and is out of scope here; this fix closes the safety property
   that holds regardless (never CLAIM an attachment that was never found).
   The lower-level draftEmail.ts service already had the correct
   never-fabricate rules for both recipient and attachment — this fix makes
   the layers ABOVE it (system prompt, client prefill) stop bypassing them.

Tests: tests/contactgraph-people-projection-batching.test.ts (batching +
migration-not-missing verification) and
tests/aigentme-email-recipient-attachment-safety.test.ts (prompt + client
fallback safety) — both new.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/data/personas.ts` |
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `services/contactGraph/contactEndpoints.ts` |
| Modified | `services/contactGraph/contactPersonas.ts` |
| Modified | `services/contactGraph/projection.ts` |
| Added | `tests/aigentme-email-recipient-attachment-safety.test.ts` |
| Added | `tests/contactgraph-people-projection-batching.test.ts` |

## Stats

 7 files changed, 420 insertions(+), 24 deletions(-)
