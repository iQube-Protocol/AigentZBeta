# Commit Brief: `8b2a91e` — Add permanent architectural rule: NEVER use Railway directly

| Field | Value |
|-------|-------|
| SHA | [`8b2a91e`](https://github.com/iQube-Protocol/AigentZBeta/commit/8b2a91e6e94760cc860176e08ff50a9799380b0b) |
| Author | Kn0w-1 |
| Date | 2026-02-24T06:51:49Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add permanent architectural rule: NEVER use Railway directly

🚨 CRITICAL RULE ENFORCEMENT:
- Created docs/qubetalk/AA_PROXY_ARCHITECTURAL_RULE.md (permanent rule)
- Updated QUBETALK_README.md with critical rules section
- Added code comments in runtime.ts and aa-proxy with warnings
- Multiple enforcement points prevent future bypass

✅ CORRECT: Always use aa-proxy endpoint
🚫 FORBIDDEN: Never use Railway directly

Reason: Prevents iframe 404 errors, provides fallback protection
```

## Files Changed

_File details not available in backfill — see commit link above._
