# Commit Brief: `290ddbf` — disable Safari email AutoFill on aigentMe compose prompt inputs

| Field | Value |
|-------|-------|
| SHA | [`290ddbf`](https://github.com/iQube-Protocol/AigentZBeta/commit/290ddbf6c839a5c4290c148867f72467e8a47c6d) |
| Author | Claude |
| Date | 2026-05-22T17:54:40Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
disable Safari email AutoFill on aigentMe compose prompt inputs

Safari sees "alice@example.com" in the placeholder of the
"What's the X for?" input and treats the field as a candidate for
contacts AutoFill — clicking the adjacent mic button (or anything
that touches input focus) popped the email dropdown over the prompt.

Setting autoComplete="off", a non-email-looking name, autoCorrect="off"
and spellCheck={false} on all six compose modal prompt inputs tells
Safari this is free-form text, not an address field.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Safari sees "alice@example.com" in the placeholder of the
"What's the X for?" input and treats the field as a candidate for
contacts AutoFill — clicking the adjacent mic button (or anything
that touches input focus) popped the email dropdown over the prompt.

Setting autoComplete="off", a non-email-looking name, autoCorrect="off"
and spellCheck={false} on all six compose modal prompt inputs tells
Safari this is free-form text, not an address field.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `components/metame/connections/ComposeCalendarEventModal.tsx` |
| Modified | `components/metame/connections/ComposeGmailDraftModal.tsx` |
| Modified | `components/metame/connections/ComposeGoogleDocModal.tsx` |
| Modified | `components/metame/connections/ComposeGoogleSheetModal.tsx` |
| Modified | `components/metame/connections/ComposeMarketaEmailModal.tsx` |
| Modified | `components/metame/connections/ComposeSlidesModal.tsx` |

## Stats

 7 files changed, 25 insertions(+), 1 deletion(-)
