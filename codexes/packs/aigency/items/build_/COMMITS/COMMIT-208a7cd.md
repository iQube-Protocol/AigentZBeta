# Commit Brief: `208a7cd` — fix: Add DynamicMode type mapping between DrawerSet and SmartTriadSet

| Field | Value |
|-------|-------|
| SHA | [`208a7cd`](https://github.com/iQube-Protocol/AigentZBeta/commit/208a7cdec5c8d5d5b534ea516f934002a1b4c40e) |
| Author | Kn0w-1 |
| Date | 2025-12-07T00:00:51Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add DynamicMode type mapping between DrawerSet and SmartTriadSet

- DrawerSet uses: 'static-only' | 'allow-dynamic' | 'dynamic-by-default'
- SmartTriadSet uses: 'static-only' | 'copilot-suggest' | 'copilot-adaptive'
- Add mapDynamicMode helper to convert between incompatible types
- Mapping: allow-dynamic -> copilot-suggest, dynamic-by-default -> copilot-adaptive

Fixes TypeScript compilation error:
Type 'allow-dynamic' is not assignable to SmartTriadSet dynamicMode at line 53
```

## Files Changed

_File details not available in backfill — see commit link above._
