# Commit Brief: `b791188` — Correct fs-operate label to bare Operate; open MoneyPenny in the same frame

| Field | Value |
|-------|-------|
| SHA | [`b791188`](https://github.com/iQube-Protocol/AigentZBeta/commit/b791188d7a5e4ebfc96ca59ecec4bc422e95e889) |
| Author | Claude |
| Date | 2026-09-02T06:01:57Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Correct fs-operate label to bare Operate; open MoneyPenny in the same frame

Live review on dev: "Operate with MoneyPenny" read poorly truncated in
the stage stepper, and the distinct fs-operate stage id already prevents
any routing/receipt collision with the advanced Horizen aigentme stage
(which also shows "Operate") without needing a qualified label.

Open MoneyPenny previously used window.open(url, '_blank') — popping a
new browser tab out of the Journey Spine's own iframe. Switched to
window.location.assign so it navigates within the same frame instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

Live review on dev: "Operate with MoneyPenny" read poorly truncated in
the stage stepper, and the distinct fs-operate stage id already prevents
any routing/receipt collision with the advanced Horizen aigentme stage
(which also shows "Operate") without needing a qualified label.

Open MoneyPenny previously used window.open(url, '_blank') — popping a
new browser tab out of the Journey Spine's own iframe. Switched to
window.location.assign so it navigates within the same frame instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/journey/FinancialSovereigntyOperateStage.tsx` |
| Modified | `services/journey/constitutionalInternetBridgeJourney.ts` |
| Modified | `services/journey/knytsBridgeCrossingJourney.ts` |
| Modified | `tests/fs-operate-stage.test.ts` |

## Stats

 4 files changed, 28 insertions(+), 14 deletions(-)
