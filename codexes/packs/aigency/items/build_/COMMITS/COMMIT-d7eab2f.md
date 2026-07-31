# Commit Brief: `d7eab2f` — ops: AnchorCalibrationCard — runtime tuning panel on /ops

| Field | Value |
|-------|-------|
| SHA | [`d7eab2f`](https://github.com/iQube-Protocol/AigentZBeta/commit/d7eab2f95dc4bf72ed82850bc8577d98eb91785b) |
| Author | Claude |
| Date | 2026-06-01T12:38:16Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
ops: AnchorCalibrationCard — runtime tuning panel on /ops

Adds a new card "Anchor Calibration (K / T / cron)" to the ops grid
between Canister Sync Status and ICP DVN. Lets the operator:

- View + edit K (batch size), T (max-age minutes), cron cadence (s)
  with bound checks matching the calibration endpoint
- Pause / Resume anchor cycles via a kill-switch button (auto-saves)
- See live anchor-history mini-feed: last 20 ticks with action badge
  (anchored / deferred / skipped / failed), decision_reason, drift
  before/after, receipt count, duration, errors, anchor txid
- Current-policy summary at a glance: thresholds + audit SLA + cron
  expectation

All edits land via PUT /api/ops/sync/calibration with persona spine
admin gate. Pause toggle auto-saves for immediate effect.

Refresh every 30s. Manual refresh button. Save button disabled when
no draft changes. Saved toast flashes on success.
```

## Body

Adds a new card "Anchor Calibration (K / T / cron)" to the ops grid
between Canister Sync Status and ICP DVN. Lets the operator:

- View + edit K (batch size), T (max-age minutes), cron cadence (s)
  with bound checks matching the calibration endpoint
- Pause / Resume anchor cycles via a kill-switch button (auto-saves)
- See live anchor-history mini-feed: last 20 ticks with action badge
  (anchored / deferred / skipped / failed), decision_reason, drift
  before/after, receipt count, duration, errors, anchor txid
- Current-policy summary at a glance: thresholds + audit SLA + cron
  expectation

All edits land via PUT /api/ops/sync/calibration with persona spine
admin gate. Pause toggle auto-saves for immediate effect.

Refresh every 30s. Manual refresh button. Save button disabled when
no draft changes. Saved toast flashes on success.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/ops/page.tsx` |
| Added | `components/ops/AnchorCalibrationCard.tsx` |

## Stats

 2 files changed, 394 insertions(+)
