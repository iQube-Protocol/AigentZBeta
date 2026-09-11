# Commit Brief: `1ea799b` — Add GIN index on activity_receipts.agents_invoked + raise ops route timeouts

| Field | Value |
|-------|-------|
| SHA | [`1ea799b`](https://github.com/iQube-Protocol/AigentZBeta/commit/1ea799b68621043b6a823946197546732373e743) |
| Author | Claude |
| Date | 2026-08-09T18:23:29Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add GIN index on activity_receipts.agents_invoked + raise ops route timeouts

The operator hit a live TimeoutError on findAgentReceiptRefs for
standing_accrued via the new forensics/correction ops routes. agents_invoked
(the array column every agent-scoped receipt lookup filters on with @>
containment) has never had an index that can accelerate array containment —
only action_type and created_at are indexed. Adds the GIN index and raises
the three new ops routes to the same maxDuration the journey state route
already uses, as a stopgap against the default serverless timeout while the
migration propagates.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7
```

## Body

The operator hit a live TimeoutError on findAgentReceiptRefs for
standing_accrued via the new forensics/correction ops routes. agents_invoked
(the array column every agent-scoped receipt lookup filters on with @>
containment) has never had an index that can accelerate array containment —
only action_type and created_at are indexed. Adds the GIN index and raises
the three new ops routes to the same maxDuration the journey state route
already uses, as a stopgap against the default serverless timeout while the
migration propagates.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VKSCjcikJZkkibzBctiun7

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/ops/dvn/agent-receipts/route.ts` |
| Modified | `app/api/ops/journey/agent-forensics/route.ts` |
| Modified | `app/api/ops/journey/correct-premature-standing-seed/route.ts` |
| Added | `supabase/migrations/20260930002600_activity_receipts_agents_invoked_gin_index.sql` |

## Stats

 5 files changed, 40 insertions(+), 1 deletion(-)
