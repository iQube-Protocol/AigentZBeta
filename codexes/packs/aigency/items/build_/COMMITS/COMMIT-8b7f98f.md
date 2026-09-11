# Commit Brief: `8b7f98f` — intent chains commit 4: API routes — dispatch + detail + list + cancel + complete-step + feedback

| Field | Value |
|-------|-------|
| SHA | [`8b7f98f`](https://github.com/iQube-Protocol/AigentZBeta/commit/8b7f98f173e79aa8c8bc40c134f0eb41b1be9acc) |
| Author | Claude |
| Date | 2026-06-02T01:13:27Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
intent chains commit 4: API routes — dispatch + detail + list + cancel + complete-step + feedback

The orchestrator's HTTP surface. All routes spine-gated (getActivePersona)
with T1 projections; admin overrides where appropriate.

POST /api/intent-chains/dispatch
- Wraps dispatchChain(). Body: { template_id, initiating_nbe_id?,
  nbe_seed?, context_seed?, cartridge? }. Maps DispatchError codes to
  HTTP status (404/422/402/503/500). 402 for chain_spend_denied
  (payment-required) keeps the Q¢ rail semantics explicit even though
  v1 wallet integration is still stubbed.

GET /api/intent-chains/[chain_id]
- T1 projection (initiated_by_persona_id stripped). Returns the chain
  row + reconstructed step history (orchestration_events filtered by
  metadata->>'chain_id') + this caller's feedback row if any.
- Owner OR admin only; 404 (never 403) when the caller doesn't own —
  per PRD §8.2 don't-leak-existence convention.

GET /api/intent-chains
- List the caller's chains. ?status= + ?cartridge= + ?template_id= +
  ?limit= filters. Admin can pass ?persona_id= to query someone else's.
- Explicit column allowlist on the select — initiated_by_persona_id
  NEVER in the projection.

POST /api/intent-chains/[chain_id]/cancel
- Owner only. Idempotent against already-terminated (409). Emits
  intent_chain_cancelled DVN receipt. Clears scheduled_advance_at +
  wait_timeout_at so cron skips. In-flight RPCs aren't interrupted
  but the advancer's status guard ignores their outcomes when chain
  is no longer active/waiting.

POST /api/intent-chains/[chain_id]/complete-step
- The seam endpoint for user-driven advancement (compose + approve
  steps). Body: { artifact_id?, title?, decision?: 'confirm'|'reject',
  ...payload }. Owner + status active|waiting + step_kind compose|
  approve guards before calling completeUserStep. Returns the new
  current_step_* state after the advancer transitions.
- This is what the AigentMeWelcomeSplitTab seam (commit 7) will call
  after /api/assistant/create-artifact returns successfully.

GET + PUT /api/intent-chains/[chain_id]/feedback
- Per §6.7. PUT semantics: upsert on (chain_id, persona); re-rating
  overwrites and emits a fresh intent_chain_feedback_recorded receipt.
- comment truncated to 2000 chars at insert. Sanitizer rewrites the
  receipt metadata so comment text NEVER leaves the DB — only
  comment_present bool surfaces on the cross-chain ledger.

GET /api/intent-chains/feedback/aggregate?template_id=X
- Admin only. PostgREST nested select pulls intent_chain_feedback rows
  grouped through intent_chains for the template. Returns
  like_count, dislike_count, like_ratio, comment_count, and a sample
  of the most recent dislike comments for failure-mode review.
- This is the T1 admin surface — the comments ARE returned (no
  sanitizer applied) because the operator + Aigent Z need them for
  the training corpus. Never sent to receipts.

Type alignment: every route uses the T1 projection shape — explicit
column allowlists on selects, never `SELECT *` for client-bound responses
where it'd risk leaking initiated_by_persona_id.
```

## Body

The orchestrator's HTTP surface. All routes spine-gated (getActivePersona)
with T1 projections; admin overrides where appropriate.

POST /api/intent-chains/dispatch
- Wraps dispatchChain(). Body: { template_id, initiating_nbe_id?,
  nbe_seed?, context_seed?, cartridge? }. Maps DispatchError codes to
  HTTP status (404/422/402/503/500). 402 for chain_spend_denied
  (payment-required) keeps the Q¢ rail semantics explicit even though
  v1 wallet integration is still stubbed.

GET /api/intent-chains/[chain_id]
- T1 projection (initiated_by_persona_id stripped). Returns the chain
  row + reconstructed step history (orchestration_events filtered by
  metadata->>'chain_id') + this caller's feedback row if any.
- Owner OR admin only; 404 (never 403) when the caller doesn't own —
  per PRD §8.2 don't-leak-existence convention.

GET /api/intent-chains
- List the caller's chains. ?status= + ?cartridge= + ?template_id= +
  ?limit= filters. Admin can pass ?persona_id= to query someone else's.
- Explicit column allowlist on the select — initiated_by_persona_id
  NEVER in the projection.

POST /api/intent-chains/[chain_id]/cancel
- Owner only. Idempotent against already-terminated (409). Emits
  intent_chain_cancelled DVN receipt. Clears scheduled_advance_at +
  wait_timeout_at so cron skips. In-flight RPCs aren't interrupted
  but the advancer's status guard ignores their outcomes when chain
  is no longer active/waiting.

POST /api/intent-chains/[chain_id]/complete-step
- The seam endpoint for user-driven advancement (compose + approve
  steps). Body: { artifact_id?, title?, decision?: 'confirm'|'reject',
  ...payload }. Owner + status active|waiting + step_kind compose|
  approve guards before calling completeUserStep. Returns the new
  current_step_* state after the advancer transitions.
- This is what the AigentMeWelcomeSplitTab seam (commit 7) will call
  after /api/assistant/create-artifact returns successfully.

GET + PUT /api/intent-chains/[chain_id]/feedback
- Per §6.7. PUT semantics: upsert on (chain_id, persona); re-rating
  overwrites and emits a fresh intent_chain_feedback_recorded receipt.
- comment truncated to 2000 chars at insert. Sanitizer rewrites the
  receipt metadata so comment text NEVER leaves the DB — only
  comment_present bool surfaces on the cross-chain ledger.

GET /api/intent-chains/feedback/aggregate?template_id=X
- Admin only. PostgREST nested select pulls intent_chain_feedback rows
  grouped through intent_chains for the template. Returns
  like_count, dislike_count, like_ratio, comment_count, and a sample
  of the most recent dislike comments for failure-mode review.
- This is the T1 admin surface — the comments ARE returned (no
  sanitizer applied) because the operator + Aigent Z need them for
  the training corpus. Never sent to receipts.

Type alignment: every route uses the T1 projection shape — explicit
column allowlists on selects, never `SELECT *` for client-bound responses
where it'd risk leaking initiated_by_persona_id.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/intent-chains/[chain_id]/cancel/route.ts` |
| Added | `app/api/intent-chains/[chain_id]/complete-step/route.ts` |
| Added | `app/api/intent-chains/[chain_id]/feedback/route.ts` |
| Added | `app/api/intent-chains/[chain_id]/route.ts` |
| Added | `app/api/intent-chains/dispatch/route.ts` |
| Added | `app/api/intent-chains/feedback/aggregate/route.ts` |
| Added | `app/api/intent-chains/route.ts` |

## Stats

 7 files changed, 654 insertions(+)
