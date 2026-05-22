# Commit Brief: `cb8bfb4` — opt embed routes in to microphone via Permissions-Policy + bridge to Lovable

| Field | Value |
|-------|-------|
| SHA | [`cb8bfb4`](https://github.com/iQube-Protocol/AigentZBeta/commit/cb8bfb4449baeb94be5e066ece6f57ebbcdca72d) |
| Author | Claude |
| Date | 2026-05-22T20:55:54Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
opt embed routes in to microphone via Permissions-Policy + bridge to Lovable

The MediaRecorder-backed mic affordance can never see getUserMedia
inside the metame.live thin-client iframe unless two things are true:

  1. metame.live's iframe element declares allow="microphone" on its
     side (delegation). That code lives in Lovable's repo, not here —
     queued a QubeTalk bridge packet asking them to add it.
  2. dev-beta.aigentz.me's embed responses declare they accept the
     delegated permission via Permissions-Policy: microphone=(self).
     Done here in middleware.ts.

Without (2), Brave and Firefox refuse getUserMedia even when the parent
delegates. With (2) alone, browsers still refuse because the parent
hasn't delegated. Both are required.

Direct visits to https://dev-beta.aigentz.me/... (no iframe) already
work with this commit alone.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

The MediaRecorder-backed mic affordance can never see getUserMedia
inside the metame.live thin-client iframe unless two things are true:

  1. metame.live's iframe element declares allow="microphone" on its
     side (delegation). That code lives in Lovable's repo, not here —
     queued a QubeTalk bridge packet asking them to add it.
  2. dev-beta.aigentz.me's embed responses declare they accept the
     delegated permission via Permissions-Policy: microphone=(self).
     Done here in middleware.ts.

Without (2), Brave and Firefox refuse getUserMedia even when the parent
delegates. With (2) alone, browsers still refuse because the parent
hasn't delegated. Both are required.

Direct visits to https://dev-beta.aigentz.me/... (no iframe) already
work with this commit alone.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `docs/qubetalk-bridge/outbox/claude-code-dev-mic-iframe-2026-05-22T20-55-39Z.json` |
| Modified | `middleware.ts` |

## Stats

 3 files changed, 32 insertions(+), 1 deletion(-)
