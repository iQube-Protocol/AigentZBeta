# Commit Brief: `bcb1eac` — make standing a permanently active first-class tab in metaMe

| Field | Value |
|-------|-------|
| SHA | [`bcb1eac`](https://github.com/iQube-Protocol/AigentZBeta/commit/bcb1eac05585279d9a6cbdeea067edaef4b6ffe1) |
| Author | Claude |
| Date | 2026-06-19T16:09:30Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
make standing a permanently active first-class tab in metaMe

Root cause: the standing tab group carried activationId 'standing-cartridge'
and the metame-standing-ledger tab inherited that gate (useCodexConfig
inherits the group's activationId when the tab has none). In the
runtime/embed context the standing-cartridge activation isn't reliably in
the persona's active set, so both the group chip and its tab were filtered
out — clicking the label found no tab to switch to and nothing rendered.

Remove the activation gate so the Standing surface always shows, matching
the Passport tab treatment.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

Root cause: the standing tab group carried activationId 'standing-cartridge'
and the metame-standing-ledger tab inherited that gate (useCodexConfig
inherits the group's activationId when the tab has none). In the
runtime/embed context the standing-cartridge activation isn't reliably in
the persona's active set, so both the group chip and its tab were filtered
out — clicking the label found no tab to switch to and nothing rendered.

Remove the activation gate so the Standing surface always shows, matching
the Passport tab treatment.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Modified | `data/codex-configs.ts` |

## Stats

 1 file changed, 6 insertions(+), 6 deletions(-)
