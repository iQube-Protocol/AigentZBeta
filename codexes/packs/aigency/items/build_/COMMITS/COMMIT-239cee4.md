# Commit Brief: `239cee4` — fix runtime regression: render consumer task runner for admins too

| Field | Value |
|-------|-------|
| SHA | [`239cee4`](https://github.com/iQube-Protocol/AigentZBeta/commit/239cee4e309089336dcf8c710826aeba81295f80) |
| Author | Claude |
| Date | 2026-06-18T22:40:27Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix runtime regression: render consumer task runner for admins too

The inline consumer task runner (task checkboxes, reward/cost badges,
completion grant) was only rendered in the non-admin branch of the
runtime experience fork. Admin viewers (the operator) hit
runtimeAdminMode=true and saw ONLY the RuntimeCapsuleAdminEditor —
never the consumer experience with rewards, and never the reading
sprint nextActions surfaced by the packet.

The consumer task runner IS the experience. It now renders for every
viewer, with the admin pricing editor (admins) or remix editor
(consumers) shown below it as an addition rather than a replacement.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

The inline consumer task runner (task checkboxes, reward/cost badges,
completion grant) was only rendered in the non-admin branch of the
runtime experience fork. Admin viewers (the operator) hit
runtimeAdminMode=true and saw ONLY the RuntimeCapsuleAdminEditor —
never the consumer experience with rewards, and never the reading
sprint nextActions surfaced by the packet.

The consumer task runner IS the experience. It now renders for every
viewer, with the admin pricing editor (admins) or remix editor
(consumers) shown below it as an addition rather than a replacement.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/MetaMeRuntimeClient.tsx` |

## Stats

 1 file changed, 29 insertions(+), 22 deletions(-)
