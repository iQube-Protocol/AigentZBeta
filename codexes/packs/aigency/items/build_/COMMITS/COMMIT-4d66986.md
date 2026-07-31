# Commit Brief: `4d66986` — Phase 4 MVP — Bureau recommendation rights gated by Stewardship Standing

| Field | Value |
|-------|-------|
| SHA | [`4d66986`](https://github.com/iQube-Protocol/AigentZBeta/commit/4d6698611734c48e99cd687033026097992d9c0f) |
| Author | Claude |
| Date | 2026-06-16T16:30:03Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Phase 4 MVP — Bureau recommendation rights gated by Stewardship Standing

New migration 20260616300000_passport_recommendations.sql adds the
passport_recommendations table — recommender persona, candidate target
(application id or agent-card URL), recommender_kind (citizen_steward |
marketa | system), reason, assessment_payload, and a withdrawal column.
RLS lets recommenders read their own rows; service-role is the canonical
write/read path.

New POST /api/passport/recommendations + GET (steward-only):
  - citizen_steward kind: gated on Stewardship Standing >=
    STEWARDSHIP_RIGHTS_THRESHOLD (default 5), read off
    crm_persona_reputation.standing_stewardship via the identity-spine
    link (personas.id -> crm_personas.identity_persona_id). Returns 403
    code stewardship_rights_insufficient when the gate fails, surfacing
    the caller's current standing and the threshold.
  - marketa kind: reserved for Bureau-admin authority (cartridge admin).
  - Exactly one target (application id XOR agent-card URL) enforced at
    schema + endpoint level.

Steward queue (/api/passport/review/queue) now returns
recommendationCount per item via a single batched query against the new
table. PassportBureauStewardTab surfaces a cyan "★ N rec" badge next to
the priority badge when an application carries open recommendations.

Recommendation != admission — the Bureau remains sovereign. Sponsorship
grants admission; Standing must be earned; Stewardship expands
recommendation rights. This closes the Bureau-completion items from the
operationalization PRD short of the Marketa assessment passthrough and
the steward-surfaced Provisional->Standing eligibility — those are
follow-ons that compose with this surface.

https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

New migration 20260616300000_passport_recommendations.sql adds the
passport_recommendations table — recommender persona, candidate target
(application id or agent-card URL), recommender_kind (citizen_steward |
marketa | system), reason, assessment_payload, and a withdrawal column.
RLS lets recommenders read their own rows; service-role is the canonical
write/read path.

New POST /api/passport/recommendations + GET (steward-only):
  - citizen_steward kind: gated on Stewardship Standing >=
    STEWARDSHIP_RIGHTS_THRESHOLD (default 5), read off
    crm_persona_reputation.standing_stewardship via the identity-spine
    link (personas.id -> crm_personas.identity_persona_id). Returns 403
    code stewardship_rights_insufficient when the gate fails, surfacing
    the caller's current standing and the threshold.
  - marketa kind: reserved for Bureau-admin authority (cartridge admin).
  - Exactly one target (application id XOR agent-card URL) enforced at
    schema + endpoint level.

Steward queue (/api/passport/review/queue) now returns
recommendationCount per item via a single batched query against the new
table. PassportBureauStewardTab surfaces a cyan "★ N rec" badge next to
the priority badge when an application carries open recommendations.

Recommendation != admission — the Bureau remains sovereign. Sponsorship
grants admission; Standing must be earned; Stewardship expands
recommendation rights. This closes the Bureau-completion items from the
operationalization PRD short of the Marketa assessment passthrough and
the steward-surfaced Provisional->Standing eligibility — those are
follow-ons that compose with this surface.

https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/passport/recommendations/route.ts` |
| Modified | `app/api/passport/review/queue/route.ts` |
| Modified | `app/triad/components/codex/tabs/PassportBureauStewardTab.tsx` |
| Added | `supabase/migrations/20260616300000_passport_recommendations.sql` |

## Stats

 4 files changed, 338 insertions(+), 10 deletions(-)
