# Commit Brief: `f4fd3b4` — land at top of capsule/article panel on open, not bottom of chat

| Field | Value |
|-------|-------|
| SHA | [`f4fd3b4`](https://github.com/iQube-Protocol/AigentZBeta/commit/f4fd3b4e2869308637103e729cd700e23b22a508) |
| Author | Claude |
| Date | 2026-05-22T22:41:01Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
land at top of capsule/article panel on open, not bottom of chat

When an experienceQube or article opens in the runtime, the
CodexCopilotLayer message list previously always auto-scrolled to its
bottom on every displayMessages change. Because the capsule panel
message is appended as the last message (so the carousel sits below
the hero/article), that bottom-scroll landed the user at the foot of
the article — not the top.

Detect when the newest message is variant="panel" and scroll that
panel's top into view via the chat container's scrollTop, instead of
slamming to the container bottom. Chat-style assistant/user messages
keep the existing scroll-to-bottom behaviour, so streaming responses
still pin to the latest tokens.

Adds data-message-id + data-message-variant on the panel wrapper so
the scroller can find it deterministically.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

When an experienceQube or article opens in the runtime, the
CodexCopilotLayer message list previously always auto-scrolled to its
bottom on every displayMessages change. Because the capsule panel
message is appended as the last message (so the carousel sits below
the hero/article), that bottom-scroll landed the user at the foot of
the article — not the top.

Detect when the newest message is variant="panel" and scroll that
panel's top into view via the chat container's scrollTop, instead of
slamming to the container bottom. Chat-style assistant/user messages
keep the existing scroll-to-bottom behaviour, so streaming responses
still pin to the latest tokens.

Adds data-message-id + data-message-variant on the panel wrapper so
the scroller can find it deterministically.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/components/codex/CodexCopilotLayer.tsx` |

## Stats

 2 files changed, 29 insertions(+), 3 deletions(-)
