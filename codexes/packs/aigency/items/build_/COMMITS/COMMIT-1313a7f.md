# Commit Brief: `1313a7f` — feat: Enable auto-start for iQube & QCT Event Register

| Field | Value |
|-------|-------|
| SHA | [`1313a7f`](https://github.com/iQube-Protocol/AigentZBeta/commit/1313a7f55e636b95c8156a9b1c9067d45a4a036d) |
| Author | Know1 |
| Date | 2025-10-19T10:20:54Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: Enable auto-start for iQube & QCT Event Register

🚀 RESTORE DEFAULT ACTIVE STATE: Event Register Auto-Start

**Why Now**: QCT contracts deployed, DVN integration working
**Dual-Tracking System**:
1. QCT Contract Events - External token transactions
2. DVN Queue Messages - Internal system transactions at settlement checkpoint

**Key Changes**:
- Added autoStart parameter to useEventListener hook
- Enabled auto-start in QCTEventMonitor (autoStart=true)
- Added auto-start logic with hasAutoStarted tracking
- Enhanced documentation for dual-tracking approach

**DVN Queue Importance**:
- Captures transactions at final settlement checkpoint
- Not subject to drift (unlike PoS batching)
- Represents point where transactions leave system for LayerZero
- Perfect for tracking internal system transactions (like EVM flows)

**Expected Result**:
Event Register will automatically start and show both:
- External QCT token transactions from contracts
- Internal system transactions from DVN queue (like the 10th transaction!)

This provides complete visibility into iQube ecosystem transaction activity.
```

## Files Changed

_File details not available in backfill — see commit link above._
