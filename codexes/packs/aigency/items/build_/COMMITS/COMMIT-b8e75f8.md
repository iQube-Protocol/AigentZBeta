# Commit Brief: `b8e75f8` — add back button to Horizen MoneyPenny journey in PilotJourneyTab

| Field | Value |
|-------|-------|
| SHA | [`b8e75f8`](https://github.com/iQube-Protocol/AigentZBeta/commit/b8e75f81939e7d320505467fe63519938e056cd6) |
| Author | Claude |
| Date | 2026-08-11T20:51:03Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add back button to Horizen MoneyPenny journey in PilotJourneyTab

- Add stage navigation tracking for back button functionality
- Implement onClick handler that calls selectStage(previousStageId)
- Pass onBack prop to JourneyRunSurface
- Consistent with back button pattern on KNYTS and CI bridges
```

## Body

- Add stage navigation tracking for back button functionality
- Implement onClick handler that calls selectStage(previousStageId)
- Pass onBack prop to JourneyRunSurface
- Consistent with back button pattern on KNYTS and CI bridges

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/triad/components/codex/tabs/PilotJourneyTab.tsx` |

## Stats

 1 file changed, 28 insertions(+)
