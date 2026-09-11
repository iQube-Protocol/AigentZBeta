# Commit Brief: `a13541c` — Backlog: per-SKU renewal via persona_plan_addons table

| Field | Value |
|-------|-------|
| SHA | [`a13541c`](https://github.com/iQube-Protocol/AigentZBeta/commit/a13541ccfafc42b7aa7c9152e3e4ec1f0468a96b) |
| Author | Claude |
| Date | 2026-07-16T04:48:39Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Backlog: per-SKU renewal via persona_plan_addons table

Scopes the independent add-on billing lifecycle (own period + cancel per SKU)
that the single-row persona_plans model can't express. Deferred — Phase 21
grants access correctly on purchase (30-day window); this is a renewal/cancel
upgrade, not a launch blocker. Registered in agentiq col_updates.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Scopes the independent add-on billing lifecycle (own period + cancel per SKU)
that the single-row persona_plans model can't express. Deferred — Phase 21
grants access correctly on purchase (30-day window); this is a renewal/cancel
upgrade, not a launch blocker. Registered in agentiq col_updates.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-16_per-sku-renewal-addons-table-backlog.md` |

## Stats

 2 files changed, 87 insertions(+)
