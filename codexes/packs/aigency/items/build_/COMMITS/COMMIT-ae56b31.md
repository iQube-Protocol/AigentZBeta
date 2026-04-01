# Commit Brief: `ae56b31` — fix: Auto-verify evidence to enable reputation scoring

| Field | Value |
|-------|-------|
| SHA | [`ae56b31`](https://github.com/iQube-Protocol/AigentZBeta/commit/ae56b31fe2efccd9aff191b6adde492bcfbcfefe) |
| Author | Know1 |
| Date | 2025-10-21T15:41:26Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Auto-verify evidence to enable reputation scoring

CRITICAL FIX: Evidence submissions now immediately affect reputation score

PROBLEM:
- Evidence was created with verified=false
- Score calculation only counted verified evidence
- Result: Score stayed at 0 despite evidence submissions

SOLUTION:
- Changed verified from false to true on evidence creation
- Evidence now auto-verified for MVP
- Scoring system now works: weight * 10.0 per evidence
- TODO: Add manual verification workflow later if needed

IMPACT:
- 2 evidence submissions with weight 0.5 each = score ~10
- Score will now update immediately after evidence submission
- Bucket level will auto-calculate from score

DEPLOYMENT REQUIRED:
- Must rebuild and redeploy RQH canister to IC mainnet
- Existing evidence will remain unverified (score still 0)
- New evidence submissions will be auto-verified
```

## Files Changed

_File details not available in backfill — see commit link above._
