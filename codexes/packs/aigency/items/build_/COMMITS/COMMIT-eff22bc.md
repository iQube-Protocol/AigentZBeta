# Commit Brief: `eff22bc` — flip steward queue cards to decided state after approve/deny

| Field | Value |
|-------|-------|
| SHA | [`eff22bc`](https://github.com/iQube-Protocol/AigentZBeta/commit/eff22bc7cb9ef84f0e6d431c0ee3c07e14bc658c) |
| Author | Claude |
| Date | 2026-06-14T19:33:23Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
flip steward queue cards to decided state after approve/deny

After a steward clicks Approve/Deny/Needs Info, the card now
flips to show the decision (emerald/rose/amber border + badge)
and hides the action buttons so the same application cannot be
decided twice. Backend already guards against double-approval
(returns error for non-open statuses) but the UI gave no visual
feedback, causing stewards to re-click.

https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

After a steward clicks Approve/Deny/Needs Info, the card now
flips to show the decision (emerald/rose/amber border + badge)
and hides the action buttons so the same application cannot be
decided twice. Backend already guards against double-approval
(returns error for non-open statuses) but the UI gave no visual
feedback, causing stewards to re-click.

https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/PassportBureauStewardTab.tsx` |

## Stats

 1 file changed, 102 insertions(+), 51 deletions(-)
