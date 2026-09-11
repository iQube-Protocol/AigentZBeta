# Commit Brief: `e201597` — Fix receipts-route allowlist drift hiding MoneyPenny's Register ceremony evidence

| Field | Value |
|-------|-------|
| SHA | [`e201597`](https://github.com/iQube-Protocol/AigentZBeta/commit/e2015975513e3e2d814c38637679de3782878ed5) |
| Author | Claude |
| Date | 2026-08-08T23:34:27Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix receipts-route allowlist drift hiding MoneyPenny's Register ceremony evidence

Root cause of "No receipts recorded for this stage yet" on the Horizen
journey's Evidence panel: VALID_ACTION_TYPES in
app/api/assistant/receipts/route.ts was never updated when the five
Wallet Signing Topology receipt types shipped (2026-08-01), and the same
drift existed for every later stage's receiptTypes too (Passport, Delegate,
aigentMe, Ratify's agreement receipts, Deploy, Standing). The receipts
were written correctly throughout — agentsInvoked was correct, personaId
was correct — only the presentational drawer's filtered query dropped
them. The journey's own state resolution bypasses this allowlist and was
never affected.

Also fixes a related param-name bug in RegisterAgentPanel's broadcast-
recovery read (actionTypes= -> actionType=, matching what the route
actually parses) and the test that had encoded the old, wrong param name
as an expectation.

Added a canary that walks every receiptTypes entry in
horizenMoneyPennyJourney.ts and asserts it against the allowlist, so a
future stage addition can't reintroduce this silently.
```

## Body

Root cause of "No receipts recorded for this stage yet" on the Horizen
journey's Evidence panel: VALID_ACTION_TYPES in
app/api/assistant/receipts/route.ts was never updated when the five
Wallet Signing Topology receipt types shipped (2026-08-01), and the same
drift existed for every later stage's receiptTypes too (Passport, Delegate,
aigentMe, Ratify's agreement receipts, Deploy, Standing). The receipts
were written correctly throughout — agentsInvoked was correct, personaId
was correct — only the presentational drawer's filtered query dropped
them. The journey's own state resolution bypasses this allowlist and was
never affected.

Also fixes a related param-name bug in RegisterAgentPanel's broadcast-
recovery read (actionTypes= -> actionType=, matching what the route
actually parses) and the test that had encoded the old, wrong param name
as an expectation.

Added a canary that walks every receiptTypes entry in
horizenMoneyPennyJourney.ts and asserts it against the allowlist, so a
future stage addition can't reintroduce this silently.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/assistant/receipts/route.ts` |
| Modified | `components/journey/RegisterAgentPanel.tsx` |
| Added | `tests/assistant-receipts-action-type-allowlist-parity.test.ts` |
| Modified | `tests/register-ceremony.test.ts` |

## Stats

 4 files changed, 145 insertions(+), 2 deletions(-)
