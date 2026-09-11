# Commit Brief: `7febd30` — fix standing_document upload constraint + ground all draft generators

| Field | Value |
|-------|-------|
| SHA | [`7febd30`](https://github.com/iQube-Protocol/AigentZBeta/commit/7febd30f68fff7c928a4cf7aede88725932023ff) |
| Author | Claude |
| Date | 2026-06-25T02:08:03Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix standing_document upload constraint + ground all draft generators

Two fixes:
- Migration adds 'standing_document' to the persona_uploads_use_kind_check
  CHECK constraint (the type/route allowlist already had it; the DB constraint
  rejected it → "violates check constraint persona_uploads_use_kind_check").
- callDraftLlm now appends GROUNDING_MANDATE to every drafter's system prompt
  (doc/email/slides/sheet/calendar). This stops a "venture progress report"
  Google Doc from fabricating KPIs ("75% completion", "20% increase in
  engagement", "10% growth") — drafters may compose prose but never invent
  metrics/percentages/trends not in the supplied context.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA
```

## Body

Two fixes:
- Migration adds 'standing_document' to the persona_uploads_use_kind_check
  CHECK constraint (the type/route allowlist already had it; the DB constraint
  rejected it → "violates check constraint persona_uploads_use_kind_check").
- callDraftLlm now appends GROUNDING_MANDATE to every drafter's system prompt
  (doc/email/slides/sheet/calendar). This stops a "venture progress report"
  Google Doc from fabricating KPIs ("75% completion", "20% increase in
  engagement", "10% growth") — drafters may compose prose but never invent
  metrics/percentages/trends not in the supplied context.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011WbEHMJb5S4TDxmbbCFBJA

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/agents/_lib/llmDraftHelper.ts` |
| Added | `supabase/migrations/20260625000000_persona_uploads_standing_document.sql` |

## Stats

 2 files changed, 39 insertions(+), 3 deletions(-)
