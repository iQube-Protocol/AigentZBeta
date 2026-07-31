# Commit Brief: `336eacc` — backlog: auto-merge workflow repair + anchor cron scheduler wiring

| Field | Value |
|-------|-------|
| SHA | [`336eacc`](https://github.com/iQube-Protocol/AigentZBeta/commit/336eacc81cd76e8d7403c05edc8d69b50e7dffa6) |
| Author | Claude |
| Date | 2026-06-01T23:26:40Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
backlog: auto-merge workflow repair + anchor cron scheduler wiring

Two ops-infra items filed per operator request after the anchor cron
ship-out (commits 3138ef5b..72e03a8d).

1) Auto-merge workflow on claude/** → dev has been silently failing
   for the recent stretch — every session needs manual `git push
   origin HEAD:dev` fallback. Per CLAUDE.md the fix is to ensure
   .github/workflows/merge-claude-to-dev.yml exists on `main`, or
   merge fix/add-merge-workflow. Checklist + acceptance criteria
   captured.

2) Cron scheduler wiring — the cron-tick endpoint is live and
   curl-tested (confirmed end-to-end through anchor_history). What
   remains is wiring an external recurring trigger. Uptime Robot
   recommended for fastest path (free tier 5-min cadence, paid 1-min),
   with Better Stack / GitHub Actions / EventBridge as alternatives.
   2-week cadence-tuning loop described referencing the K/T policy
   knobs on /ops.

Registered in agentiq Updates collection.
```

## Body

Two ops-infra items filed per operator request after the anchor cron
ship-out (commits 3138ef5b..72e03a8d).

1) Auto-merge workflow on claude/** → dev has been silently failing
   for the recent stretch — every session needs manual `git push
   origin HEAD:dev` fallback. Per CLAUDE.md the fix is to ensure
   .github/workflows/merge-claude-to-dev.yml exists on `main`, or
   merge fix/add-merge-workflow. Checklist + acceptance criteria
   captured.

2) Cron scheduler wiring — the cron-tick endpoint is live and
   curl-tested (confirmed end-to-end through anchor_history). What
   remains is wiring an external recurring trigger. Uptime Robot
   recommended for fastest path (free tier 5-min cadence, paid 1-min),
   with Better Stack / GitHub Actions / EventBridge as alternatives.
   2-week cadence-tuning loop described referencing the K/T policy
   knobs on /ops.

Registered in agentiq Updates collection.

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-06-01_auto-merge-workflow-and-cron-scheduler-backlog.md` |

## Stats

 2 files changed, 104 insertions(+), 1 deletion(-)
