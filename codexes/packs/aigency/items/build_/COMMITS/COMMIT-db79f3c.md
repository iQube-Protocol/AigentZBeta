# Commit Brief: `db79f3c` — Harden A2 publish: config-write-first ordering + optimistic concurrency

| Field | Value |
|-------|-------|
| SHA | [`db79f3c`](https://github.com/iQube-Protocol/AigentZBeta/commit/db79f3cddf0be7b8253e78dd34ecb0084df5f50b) |
| Author | Claude |
| Date | 2026-09-02T00:45:21Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Harden A2 publish: config-write-first ordering + optimistic concurrency

publishPlacement now writes the live knyts_bridge_editorial_config row
BEFORE updating bridge_content_placements' own bookkeeping (previously the
reverse), because the config row is what the public reader actually
consumes. If the bookkeeping update fails or loses a concurrency race
afterward, the live site is still correct - only the audit/draft-state
bookkeeping is stale, recoverable by re-publishing the same draft
(idempotent). The old ordering risked the opposite failure: the placement
row claiming "published" while the live config was never actually written.

Adds an optimistic-concurrency guard (WHERE revision = <the revision read
at the start of this publish>) on the bookkeeping update, raising a new
PlacementConflictError - never a silent overwrite - when a concurrent
assign/publish on the same slot changed the row first. The route surfaces
this as 409 concurrent-edit-detected, alongside the existing 409
no-draft-to-publish.

Two new tests pin the write ordering and the conflict path explicitly.

This is a partial A2 hardening pass (operator directive, 2026-09-02):
integrated asset selection/upload and infographic-specific coverage remain
open, tracked separately.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

publishPlacement now writes the live knyts_bridge_editorial_config row
BEFORE updating bridge_content_placements' own bookkeeping (previously the
reverse), because the config row is what the public reader actually
consumes. If the bookkeeping update fails or loses a concurrency race
afterward, the live site is still correct - only the audit/draft-state
bookkeeping is stale, recoverable by re-publishing the same draft
(idempotent). The old ordering risked the opposite failure: the placement
row claiming "published" while the live config was never actually written.

Adds an optimistic-concurrency guard (WHERE revision = <the revision read
at the start of this publish>) on the bookkeeping update, raising a new
PlacementConflictError - never a silent overwrite - when a concurrent
assign/publish on the same slot changed the row first. The route surfaces
this as 409 concurrent-edit-detected, alongside the existing 409
no-draft-to-publish.

Two new tests pin the write ordering and the conflict path explicitly.

This is a partial A2 hardening pass (operator directive, 2026-09-02):
integrated asset selection/upload and infographic-specific coverage remain
open, tracked separately.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/journey/knyts-bridge/placements/route.ts` |
| Modified | `services/journey/bridgeContentPlacements.ts` |
| Modified | `tests/bridge-content-placements.test.ts` |

## Stats

 3 files changed, 102 insertions(+), 17 deletions(-)
