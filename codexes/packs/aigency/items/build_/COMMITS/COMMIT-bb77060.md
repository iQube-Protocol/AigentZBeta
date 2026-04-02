# Commit Brief: `bb77060` — fix: PersonaSelector now properly triggers reputation display

| Field | Value |
|-------|-------|
| SHA | [`bb77060`](https://github.com/iQube-Protocol/AigentZBeta/commit/bb77060f4f98d39b0663d8f5078a52cc5f1956e9) |
| Author | Know1 |
| Date | 2025-10-21T15:11:48Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: PersonaSelector now properly triggers reputation display

- Removed conflicting custom Select component usage
- Using native select element with proper onChange handler
- Added 'Select a persona...' placeholder option
- Reputation data will now display when persona is selected

Root cause: Custom Select component had conflicting props (options array + children)
causing the onChange handler to not fire properly.
```

## Files Changed

_File details not available in backfill — see commit link above._
