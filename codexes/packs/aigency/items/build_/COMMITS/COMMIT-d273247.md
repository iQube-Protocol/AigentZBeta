# Commit Brief: `d273247` — fix activation bounce: soft-release editions (released_at) so auto-grant doesn't resurrect deactivated tabs

| Field | Value |
|-------|-------|
| SHA | [`d273247`](https://github.com/iQube-Protocol/AigentZBeta/commit/d27324754d70ee3936b07b244c7450e2776ea67a) |
| Author | Claude |
| Date | 2026-05-21T17:34:24Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix activation bounce: soft-release editions (released_at) so auto-grant doesn't resurrect deactivated tabs
```

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/activations/spineActivations.ts` |
| Modified | `services/content/claimEdition.ts` |
| Added | `supabase/migrations/20260524010000_content_qube_editions_released_at.sql` |

## Stats

 3 files changed, 123 insertions(+), 22 deletions(-)
