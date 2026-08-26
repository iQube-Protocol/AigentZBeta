# Commit Brief: `4c8c259` — fix(agentme): preserve attachments and resolve contact ambiguity

| Field | Value |
|-------|-------|
| SHA | [`4c8c259`](https://github.com/iQube-Protocol/AigentZBeta/commit/4c8c259c2689d80dbef390e77dd3605ca69921a2) |
| Author | Kn0w1 |
| Date | 2026-08-26T03:05:42-04:00 |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix(agentme): preserve attachments and resolve contact ambiguity

Preserve current Gmail/Marketa attachment state and present explicit recipient choices when the canonical contact resolver returns multiple endpoints.
```

## Body

Preserve current Gmail/Marketa attachment state and present explicit recipient choices when the canonical contact resolver returns multiple endpoints.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx` |
| Modified | `components/metame/connections/ComposeGmailDraftModal.tsx` |
| Modified | `components/metame/connections/ComposeMarketaEmailModal.tsx` |
| Added | `tests/agentme-email-composition-regression.test.ts` |

## Stats

 4 files changed, 88 insertions(+), 3 deletions(-)
