# Commit Brief: `d5b2db2` — fix: Replace non-existent positionType with assetIn.symbol in DefiPosition display

| Field | Value |
|-------|-------|
| SHA | [`d5b2db2`](https://github.com/iQube-Protocol/AigentZBeta/commit/d5b2db29765d3d30ee0f84ea09498cc0483f68aa) |
| Author | Kn0w-1 |
| Date | 2025-12-06T21:43:34Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Replace non-existent positionType with assetIn.symbol in DefiPosition display

- DefiPosition interface doesn't have positionType property
- Use assetIn.symbol instead which exists in the interface
- Update subtitle format to show asset symbol and chain

Fixes TypeScript compilation error:
'Property positionType does not exist on type DefiPosition' at line 558
```

## Files Changed

_File details not available in backfill — see commit link above._
